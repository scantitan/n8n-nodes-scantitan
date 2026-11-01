import type { IExecuteFunctions, IDataObject, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { apiRequest, identifier } from './GenericFunctions';

export class ScanTitan implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'ScanTitan', name: 'scanTitan', icon: { light: 'file:scantitan.svg', dark: 'file:scantitan.svg' }, subtitle: '={{$parameter["operation"]}}', usableAsTool: true, group: ['transform'], version: 1,
		description: 'Run website scans and retrieve security findings and monitoring',
		defaults: { name: 'ScanTitan' }, inputs: [NodeConnectionTypes.Main], outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'scanTitanApi', required: true }],
		properties: [
			{ displayName: 'Resource', name: 'resource', type: 'options', noDataExpression: true, default: 'website', options: [
				{ name: 'Connection', value: 'connection' }, { name: 'Scan', value: 'scan' }, { name: 'Website', value: 'website' },
			] },
			{ displayName: 'Operation', name: 'operation', type: 'options', noDataExpression: true, default: 'connection', displayOptions: { show: { resource: ['connection'] } }, options: [
				{ name: 'Get', value: 'connection', action: 'Get a connection', description: 'Check selected websites, scopes and plan allowance' },
			] },
			{ displayName: 'Operation', name: 'operation', type: 'options', noDataExpression: true, default: 'scan', displayOptions: { show: { resource: ['scan'] } }, options: [
				{ name: 'Cancel', value: 'cancel', action: 'Cancel a scan', description: 'Cancel a queued or running scan where supported' },
				{ name: 'Get', value: 'scan', action: 'Get a scan', description: 'Retrieve scan status and assessment coverage' },
				{ name: 'Get Findings', value: 'findings', action: 'Get scan findings', description: 'Retrieve one page of findings from a completed scan' },
				{ name: 'Get Many', value: 'scans', action: 'Get many scans', description: 'Retrieve scan history for a selected website' },
				{ name: 'Start', value: 'start', action: 'Start a website scan', description: 'Request a scan within your plan allowance' },
			] },
			{ displayName: 'Operation', name: 'operation', type: 'options', noDataExpression: true, default: 'listWebsites', displayOptions: { show: { resource: ['website'] } }, options: [
				{ name: 'Create', value: 'create', action: 'Create a website', description: 'Add an owned website under an already selected customer' },
				{ name: 'Get Many', value: 'listWebsites', action: 'Get many websites', description: 'Retrieve websites selected for this connection' },
				{ name: 'Get Monitoring', value: 'monitoring', action: 'Get website monitoring', description: 'Retrieve monitoring status included in your plan' },
				{ name: 'Get Ownership Proof', value: 'ownership', action: 'Get ownership proof', description: 'Retrieve DNS or file ownership proof' },
				{ name: 'Verify', value: 'verify', action: 'Verify website ownership', description: 'Check published DNS or file ownership proof' },
			] },
			{ displayName: 'Website ID', name: 'assetId', type: 'string', default: '', required: true,
				description: 'ID from Website → Get Many. For Create, choose a selected website belonging to the customer who will own the new site.',
				displayOptions: { show: { operation: ['monitoring', 'scans', 'start', 'ownership', 'verify', 'create'] } } },
			{ displayName: 'Scan ID', name: 'scanId', type: 'string', default: '', required: true,
				displayOptions: { show: { operation: ['scan', 'findings', 'cancel'] } } },
			{ displayName: 'Idempotency Key', name: 'idempotencyKey', type: 'string', default: '', required: true,
				description: 'Unique deployment or request ID (1–120 characters). Reuse on retries to avoid another scan.',
				displayOptions: { show: { operation: ['start', 'create'] } } },
			{ displayName: 'Website Name', name: 'websiteName', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['create'] } } },
			{ displayName: 'Website URL', name: 'websiteUrl', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['create'] } } },
			{ displayName: 'Authorized', name: 'authorized', type: 'boolean', default: false, required: true, description: 'Whether you own or have permission to assess this website', displayOptions: { show: { operation: ['create', 'verify'] } } },
			{ displayName: 'Verification Method', name: 'verificationMethod', type: 'options', default: 'dns', options: [{ name: 'DNS TXT Record', value: 'dns' }, { name: 'Verification File', value: 'file' }], displayOptions: { show: { operation: ['verify'] } } },
			{ displayName: 'Page', name: 'page', type: 'number', default: 1, typeOptions: { minValue: 1 },
				displayOptions: { show: { operation: ['scans', 'findings'] } } },
			{ displayName: 'Limit', name: 'limit', type: 'number', default: 50, typeOptions: { minValue: 1, maxValue: 100 },
				description: 'Max number of results to return',
				displayOptions: { show: { operation: ['scans', 'findings'] } } },
		],
	};
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const output: INodeExecutionData[] = [];
		for (let index = 0; index < this.getInputData().length; index++) {
			try {
				const operation = this.getNodeParameter('operation', index) as string;
				let path: string;
				let key: string | undefined;
				let body: IDataObject | undefined;
				if (operation === 'connection') path = '/me';
				else if (operation === 'listWebsites') path = '/assets';
				else if (operation === 'create') {
					path = '/assets';
					body = { parent_asset_id: this.getNodeParameter('assetId', index) as string, name: this.getNodeParameter('websiteName', index) as string, url: this.getNodeParameter('websiteUrl', index) as string, authorized: this.getNodeParameter('authorized', index) as boolean };
				}
				else if (['scan', 'findings', 'cancel'].includes(operation)) {
					path = '/scans/' + identifier(this.getNodeParameter('scanId', index) as string) + (operation === 'findings' ? '/results' : operation === 'cancel' ? '/cancel' : '');
				} else {
					const endings: Record<string, string> = { monitoring: 'monitoring', scans: 'scans', start: 'scans', ownership: 'ownership', verify: 'verify' };
					if (!endings[operation]) throw new NodeOperationError(this.getNode(), 'Unknown ScanTitan operation');
					path = '/assets/' + identifier(this.getNodeParameter('assetId', index) as string) + '/' + endings[operation];
					if (operation === 'verify') body = { method: this.getNodeParameter('verificationMethod', index) as string, acknowledged: this.getNodeParameter('authorized', index) as boolean };
				}
					if (operation === 'start' || operation === 'create') {
						key = this.getNodeParameter('idempotencyKey', index) as string;
						if (!key || key.length > 120 || /[\r\n]/.test(key)) throw new NodeOperationError(this.getNode(), 'Idempotency key must be 1–120 characters');
					}
				if (operation === 'scans' || operation === 'findings') {
					const page = this.getNodeParameter('page', index) as number;
					const limit = this.getNodeParameter('limit', index) as number;
					if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new NodeOperationError(this.getNode(), 'Invalid page or limit');
					path += '?page=' + page + '&per_page=' + limit;
				}
				const response = await apiRequest(this, path, ['start', 'create', 'verify', 'cancel'].includes(operation) ? 'POST' : 'GET', body, key ? { 'Idempotency-Key': key } : undefined);
				output.push({ json: response as unknown as IDataObject, pairedItem: { item: index } });
			} catch (error) {
				if (!this.continueOnFail()) throw new NodeOperationError(this.getNode(), (error as Error).message, { itemIndex: index });
				output.push({ json: { error: (error as Error).message }, pairedItem: { item: index } });
			}
		}
		return [output];
	}
}

