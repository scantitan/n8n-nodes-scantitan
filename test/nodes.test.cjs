const {test} = require('node:test');
const assert = require('node:assert/strict');
const {ScanTitan} = require('../dist/nodes/ScanTitan/ScanTitan.node.js');
const {ScanTitanTrigger} = require('../dist/nodes/ScanTitan/ScanTitanTrigger.node.js');
function context({state = {}, mode = 'trigger', events = ['finding.opened'], operation = 'listWebsites', responses = [], apiUrl} = {}) {
  const calls = [];
  const node = {name:'ScanTitan', type:'n8n-nodes-scantitan.scanTitan', typeVersion:1, position:[0,0], parameters:{}};
  const values = {operation, events, assetId:'site/1', scanId:'scan/1', idempotencyKey:'deployment-1', page:2, limit:100, websiteName:'Store', websiteUrl:'https://store.example', authorized:true};
  return {calls, state, getNode:()=>node, getMode:()=>mode, getWorkflowStaticData:()=>state, getNodeParameter:name=>values[name],
    getInputData:()=>[{json:{}}], continueOnFail:()=>false, getCredentials:async()=>({apiUrl}),
    helpers:{httpRequestWithAuthentication:async function(type, options) {
      calls.push({type, ...options});
      const next = responses.shift();
      if(next instanceof Error) throw next;
      if(!next) throw new Error('Unexpected request');
      return next;
    }}};
}
const me = {data:{installation_id:12,application:'n8n'}};
test('first automatic poll checkpoints without historical delivery', async()=>{
  const ctx=context({responses:[me,{data:[],meta:{next_cursor:42,has_more:false}}]});
  assert.equal(await new ScanTitanTrigger().poll.call(ctx),null);
  assert.equal(ctx.state.cursor,42);
  assert.match(ctx.calls[1].url,/initial=1$/);
});
test('poll resumes pages, filters events and commits complete cursor', async()=>{
  const ctx=context({state:{installation:12,cursor:42},responses:[me,
    {data:[{id:'a',type:'scan.completed',cursor:43}],meta:{next_cursor:43,has_more:true}},
    {data:[{id:'b',type:'finding.opened',cursor:44}],meta:{next_cursor:44,has_more:false}}]});
  const result=await new ScanTitanTrigger().poll.call(ctx);
  assert.equal(result[0][0].json.id,'b');
  assert.equal(ctx.state.cursor,44);
  assert.match(ctx.calls[2].url,/after=43$/);
  assert.equal(ctx.calls[1].disableFollowRedirect,true);
});
test('failed later page leaves saved cursor untouched for replay', async()=>{
  const ctx=context({state:{installation:12,cursor:10},responses:[me,
    {data:[{id:'a',type:'finding.opened',cursor:11}],meta:{next_cursor:11,has_more:true}},new Error('secret-token')]});
  await assert.rejects(new ScanTitanTrigger().poll.call(ctx),error=>!error.message.includes('secret-token'));
  assert.equal(ctx.state.cursor,10);
});
test('changed installation resets cursor and manual test does not commit', async()=>{
  const state={installation:99,cursor:100};
  const ctx=context({state,mode:'manual',responses:[me,{data:[{id:'new',type:'finding.opened'}],meta:{next_cursor:5,has_more:false}}]});
  assert.equal((await new ScanTitanTrigger().poll.call(ctx))[0].length,1);
  assert.deepEqual(state,{installation:99,cursor:100});
  assert.match(ctx.calls[1].url,/after=0$/);
});
test('non-advancing pagination is rejected', async()=>{
  const ctx=context({state:{installation:12,cursor:1},responses:[me,{data:[],meta:{next_cursor:1,has_more:true}}]});
  await assert.rejects(new ScanTitanTrigger().poll.call(ctx),/cursor/);
});
test('event backlog is bounded and resumes without skipping', async()=>{
  const responses=[me,...Array.from({length:20},(_,i)=>({data:[{id:String(i),type:'finding.opened'}],meta:{next_cursor:i+1,has_more:true}}))];
  const ctx=context({state:{installation:12,cursor:0},responses});
  assert.equal((await new ScanTitanTrigger().poll.call(ctx))[0].length,20);
  assert.equal(ctx.state.cursor,20);
  assert.equal(ctx.calls.length,21);
});
test('scan request encodes IDs and sends retry key', async()=>{
  const ctx=context({operation:'start',responses:[{data:{id:'scan-1'}}]});
  assert.equal((await new ScanTitan().execute.call(ctx))[0][0].json.data.id,'scan-1');
  assert.match(ctx.calls[0].url,/site%2F1\/scans$/);
  assert.equal(ctx.calls[0].method,'POST');
  assert.equal(ctx.calls[0].headers['Idempotency-Key'],'deployment-1');
});
test('findings retain pagination metadata', async()=>{
  const ctx=context({operation:'findings',responses:[{data:[{id:'f'}],meta:{page:2,last_page:3,total:250}}]});
  const result=await new ScanTitan().execute.call(ctx);
  assert.equal(result[0][0].json.meta.last_page,3);
  assert.match(ctx.calls[0].url,/scan%2F1\/results\?page=2&per_page=100$/);
});
test('configured HTTPS endpoint is used and insecure endpoints never receive a request', async()=>{
  const valid=context({apiUrl:'https://staging.example/api/v2/integrations/apps/',responses:[{data:[]}]});
  await new ScanTitan().execute.call(valid);
  assert.equal(valid.calls[0].url,'https://staging.example/api/v2/integrations/apps/assets');
  for(const apiUrl of ['http://example.com','https://user:pass@example.com/api','https://example.com/api?secret=x','https://example.com/api#x']) {
    const ctx=context({apiUrl,responses:[{data:[]}]});
    await assert.rejects(new ScanTitan().execute.call(ctx));
    assert.equal(ctx.calls.length,0);
  }
});
test('credential authentication validates destination and disables redirects even for tests', async()=>{
  const {ScanTitanApi}=require('../dist/credentials/ScanTitanApi.credentials.js');
  const credential=new ScanTitanApi();
  const input={apiUrl:'https://staging.example/api',apiToken:'private-test-token'};
  const result=await credential.authenticate(input,{url:'https://staging.example/api/me',method:'GET'});
  assert.equal(result.headers.Authorization,'Bearer private-test-token');
  assert.equal(result.disableFollowRedirect,true);
  await assert.rejects(credential.authenticate(input,{url:'https://unrelated.example/api/me',method:'GET'}));
  await assert.rejects(credential.authenticate({...input,apiUrl:'http://staging.example/api'},{url:'/me',method:'GET'}));
});
test('enrollment explicitly uses selected parent and permission consent', async()=>{
  const ctx=context({operation:'create',responses:[{data:{id:'new'}}]});
  await new ScanTitan().execute.call(ctx);
  assert.equal(ctx.calls[0].body.parent_asset_id,'site/1');
  assert.equal(ctx.calls[0].body.authorized,true);
  assert.equal(ctx.calls[0].headers['Idempotency-Key'],'deployment-1');
});

