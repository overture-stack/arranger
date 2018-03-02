export const PORT = process.env.PORT || 5050;
export const ES_HOST = process.env.ES_HOST;
export const PROJECT_ID = process.env.PROJECT_ID;
export const PING_MS = process.env.PING_MS || 2200;
export const ES_LOG = process.env.ES_LOG?.split?.(',') || 'error';
