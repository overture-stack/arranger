function getValue(key, defaultValue) {
  return (
    process.env[`STORYBOOK_${key}`] ||
    process.env[`REACT_APP_${key}`] ||
    (typeof window !== 'undefined' && localStorage[key]) ||
    defaultValue
  );
}

export function setValue(key, value) {
  localStorage[key] = value;
}

export function deleteValue(key) {
  delete localStorage[key];
}

export const ARRANGER_API = getValue('ARRANGER_API', 'http://localhost:5050');
export const ES_HOST = getValue('ES_HOST', 'http://localhost:9200');
export const ACTIVE_INDEX = getValue('ACTIVE_INDEX', null);
export const DOCUMENT_TYPE = getValue('DOCUMENT_TYPE', '');
export const PORTAL_NAME = getValue('PORTAL_NAME', 'Data Portal');
export const DISABLE_SOCKET = getValue('DISABLE_SOCKET', 'false') === 'true';
