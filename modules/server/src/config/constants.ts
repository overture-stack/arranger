import { stringToBool, stringToNumber } from '@/utils/stringFns';

export const ALLOW_CUSTOM_MAX_DOWNLOAD_ROWS = stringToBool(
	process.env.ALLOW_CUSTOM_MAX_DOWNLOAD_ROWS,
);
export const CONFIG_FILES_PATH = process.env.CONFIG_PATH || './configs';
export const DEBUG_MODE = stringToBool(process.env.DEBUG);
export const DOCUMENT_TYPE = process.env.DOCUMENT_TYPE || '';
export const DOWNLOAD_STREAM_BUFFER_SIZE =
	stringToNumber(process.env.DOWNLOAD_STREAM_BUFFER_SIZE) || 2000;
export const ENABLE_ADMIN = stringToBool(process.env.ENABLE_ADMIN);
export const ENABLE_LOGS = stringToBool(process.env.ENABLE_LOGS);
export const ES_HOST = process.env.ES_HOST || 'http://127.0.0.1:9200';
export const ES_INDEX = process.env.ES_INDEX || '';
export const ES_LOG = process.env.ES_LOG?.split?.(',') || 'error';
export const ES_PASS = process.env.ES_PASS || '';
export const ES_USER = process.env.ES_USER || '';
export const MAX_DOWNLOAD_ROWS = stringToNumber(process.env.MAX_DOWNLOAD_ROWS) || 100;
export const MAX_LIVE_VERSIONS = process.env.MAX_LIVE_VERSIONS || 3;
export const MAX_RESULTS_WINDOW = stringToNumber(process.env.MAX_RESULTS_WINDOW) || 10000;
export const PING_MS = stringToNumber(process.env.PING_MS) || 2200;
export const PING_PATH = process.env.PING_PATH || '/ping';
export const PORT = stringToNumber(process.env.PORT) || 5050;
export const ROW_ID_FIELD_NAME = process.env.ROW_ID_FIELD_NAME || 'id';
