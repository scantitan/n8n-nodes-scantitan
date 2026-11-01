import type { IExecuteFunctions, IPollFunctions, IDataObject, IHttpRequestMethods } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { apiBase } from '../../credentials/endpoint';

export type Context = IExecuteFunctions | IPollFunctions;
export interface ApiResponse {
	data: IDataObject | IDataObject[];
	meta?: { next_cursor: number; has_more: boolean; last_page?: number; total?: number };
}
export async function apiRequest(context: Context, path: string, method: IHttpRequestMethods = 'GET', body?: IDataObject, headers?: IDataObject): Promise<ApiResponse> {
	try {
		const credentials = await context.getCredentials('scanTitanApi');
		const base = apiBase(credentials.apiUrl);
		return await context.helpers.httpRequestWithAuthentication.call(context, 'scanTitanApi', {
			url: base + path,
			method, body, headers: { Accept: 'application/json', ...headers },
			json: true, timeout: 30000, disableFollowRedirect: true,
		}) as ApiResponse;
	} catch {
		throw new NodeOperationError(context.getNode(), 'ScanTitan request failed. Check connection expiry, scopes, website ownership and scan allowance. Retry a scan with the same idempotency key.');
	}
}
export const identifier = (value: string): string => encodeURIComponent(value);

