import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const p=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
if(!process.argv[2])throw new Error('Pass the separately installed official scanner directory.');
const modulePath=resolve(process.argv[2],'node_modules/@n8n/scan-community-package/scanner/scanner.mjs');
const {analyzePackageByName}=await import(pathToFileURL(modulePath));
let result;
for(let attempt=0;attempt<3;attempt++){
  result=await analyzePackageByName(p.name,p.version);
  if(result.passed)break;
  if(attempt<2)await new Promise(resolve=>setTimeout(resolve,15000));
}
console.log(JSON.stringify({package:p.name,version:p.version,...result},null,2));
if(!result.passed)process.exitCode=1;
