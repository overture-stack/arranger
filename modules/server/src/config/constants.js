export const CONFIG_FILES_PATH = process.env.CONFIG_PATH || './configs';
export const ALLOW_CUSTOM_DOWNLOAD_MAX_ROWS =
  (process.env.ALLOW_CUSTOM_DOWNLOAD_MAX_ROWS || '').toLowerCase() === 'true' || false;
export const DOWNLOAD_MAX_ROWS = Number(process.env.DOWNLOAD_MAX_ROWS || '') || 100;
export const DOWNLOAD_STREAM_BUFFER_SIZE =
  Number(process.env.DOWNLOAD_STREAM_BUFFER_SIZE || '') || 2000;
export const ES_HOST = process.env.ES_HOST || 'http://localhost:9200';
export const ES_INDEX = process.env.ES_INDEX || '';
export const ES_LOG = process.env.ES_LOG?.split?.(',') || 'error';
export const ES_PASS = process.env.ES_PASS || '';
export const ES_USER = process.env.ES_USER || '';
export const GRAPHQL_FIELD = process.env.GRAPHQL_FIELD || '';
export const MAX_LIVE_VERSIONS = process.env.MAX_LIVE_VERSIONS || 3;
export const PING_MS = process.env.PING_MS || 2200;
export const PORT = process.env.PORT || 5050;
