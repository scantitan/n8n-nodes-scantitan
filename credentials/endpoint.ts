export const DEFAULT_API_URL = 'https://portal.scantitan.com/api/v2/integrations/apps';

export function apiBase(value: unknown): string {
	const base = String(value || DEFAULT_API_URL).replace(/\/+$/, '');
	const parsed = new URL(base);
	if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
		throw new Error('ScanTitan API URL must use HTTPS without credentials, query parameters or a fragment');
	}
	return base;
}
