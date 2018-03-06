function getValue(key, defaultValue) {
  return (
    process.env[`STORYBOOK_${key}`] ||
    process.env[`REACT_APP_${key}`] ||
    localStorage[key] ||
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
export const PROJECT_ID = getValue('PROJECT_ID', '');
export const ACTIVE_INDEX = getValue('ACTIVE_INDEX', '');
export const ACTIVE_INDEX_NAME = getValue('ACTIVE_INDEX_NAME', '');
export const PORTAL_NAME = getValue('PORTAL_NAME', 'Data Portal');
