export interface ArrangerMcpConfig {
	arrangerBaseUrl: string;
	requestTimeoutMs: number;
}

const DEFAULT_ARRANGER_BASE_URL = 'http://localhost:5050';
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export const createArrangerMcpConfig = (
	overrides: Partial<ArrangerMcpConfig> = {},
): ArrangerMcpConfig => ({
	arrangerBaseUrl: trimTrailingSlash(overrides.arrangerBaseUrl || process.env.ARRANGER_BASE_URL || DEFAULT_ARRANGER_BASE_URL),
	requestTimeoutMs: overrides.requestTimeoutMs || Number(process.env.ARRANGER_REQUEST_TIMEOUT_MS || DEFAULT_REQUEST_TIMEOUT_MS),
});
