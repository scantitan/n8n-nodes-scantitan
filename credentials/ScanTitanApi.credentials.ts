import type { IAuthenticate, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';
import { apiBase, DEFAULT_API_URL } from './endpoint';

export class ScanTitanApi implements ICredentialType {
	name = 'scanTitanApi';
	displayName = 'ScanTitan API';
	icon: ICredentialType['icon'] = { light: 'file:scantitan.svg', dark: 'file:scantitan.svg' };
	documentationUrl = 'https://portal.scantitan.com/integrations/index.html#n8n';
	properties: INodeProperties[] = [
		{ displayName: 'API Token', name: 'apiToken', type: 'string', typeOptions: { password: true }, default: '', required: true,
			description: 'Create an n8n connection in ScanTitan Account & plan → Connected apps' },
		{ displayName: 'API URL', name: 'apiUrl', type: 'string', default: DEFAULT_API_URL,
			description: 'Use the default for ScanTitan Cloud, or the HTTPS integration API address of your staging or self-hosted deployment' },
	];
	authenticate: IAuthenticate = async (credentials, requestOptions) => {
		const base = apiBase(credentials.apiUrl);
		const requested = new URL(requestOptions.url, base + '/');
		if (requested.origin !== new URL(base).origin) throw new Error('The request must use the configured ScanTitan service');
		return { ...requestOptions, disableFollowRedirect: true, headers: { ...requestOptions.headers, Authorization: 'Bearer ' + credentials.apiToken } };
	};
	test: ICredentialTestRequest = { request: { baseURL: '={{$credentials.apiUrl || "https://portal.scantitan.com/api/v2/integrations/apps"}}', url: '/me', disableFollowRedirect: true } };
}

