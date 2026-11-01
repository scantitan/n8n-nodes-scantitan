import type { IPollFunctions, IDataObject, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { apiRequest } from './GenericFunctions';

export class ScanTitanTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'ScanTitan Trigger', name: 'scanTitanTrigger', icon: { light: 'file:scantitan.svg', dark: 'file:scantitan.svg' }, group: ['trigger'], version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Start workflows when ScanTitan scans, findings or monitoring alerts change',
		defaults: { name: 'ScanTitan Trigger' }, polling: true, inputs: [], outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'scanTitanApi', required: true }],
		properties: [
			{ displayName: 'Events', name: 'events', type: 'multiOptions', default: ['scan.completed', 'finding.opened'],
				options: [
					{ name: 'Finding Opened', value: 'finding.opened' }, { name: 'Finding Resolved', value: 'finding.resolved' },
					{ name: 'Finding Updated', value: 'finding.updated' }, { name: 'Monitor Alert Opened', value: 'monitor.alert.opened' },
					{ name: 'Monitor Alert Resolved', value: 'monitor.alert.resolved' }, { name: 'Monitor Alert Updated', value: 'monitor.alert.updated' },
					{ name: 'Scan Completed', value: 'scan.completed' },
				], description: 'Events to emit. Use the event ID to deduplicate downstream actions.' },
		],
	};
	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const state = this.getWorkflowStaticData('node');
		const me = (await apiRequest(this, '/me')).data as IDataObject;
		if (me.application !== 'n8n') throw new NodeOperationError(this.getNode(), 'Create an n8n connected-app credential');
		const manual = this.getMode() === 'manual';
		if (state.installation !== me.installation_id || typeof state.cursor !== 'number') {
			if (!manual) {
				const initial = await apiRequest(this, '/events?initial=1');
				state.installation = me.installation_id;
				state.cursor = initial.meta!.next_cursor;
				return null;
			}
		}
		const selected = this.getNodeParameter('events') as string[];
		let cursor = state.installation === me.installation_id && typeof state.cursor === 'number' ? state.cursor : 0;
		const items: INodeExecutionData[] = [];
		for (let page = 0; page < 20; page++) {
			const response = await apiRequest(this, '/events?limit=100&after=' + cursor);
			if (!Array.isArray(response.data) || !response.meta || !Number.isSafeInteger(response.meta.next_cursor)
				|| response.meta.next_cursor < cursor || (response.meta.has_more && response.meta.next_cursor === cursor)) {
				throw new NodeOperationError(this.getNode(), 'Invalid ScanTitan event cursor');
			}
			for (const event of response.data) {
				if (selected.includes(event.type as string)) items.push({ json: event });
			}
			cursor = response.meta.next_cursor;
			if (!response.meta.has_more) break;
		}
		if (!manual) { state.installation = me.installation_id; state.cursor = cursor; }
		return items.length ? [items] : null;
	}
}

