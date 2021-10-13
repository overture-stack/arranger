declare global {
  interface Window {
    __env__: {
      REACT_APP_ARRANGER_ADMIN_ROOT: string;
      REACT_APP_BASE_URL: string;
    };
  }
}

export const adminApiRoot =
  window?.__env__?.REACT_APP_ARRANGER_ADMIN_ROOT ||
  process?.env?.REACT_APP_ARRANGER_ADMIN_ROOT ||
  'http://localhost:5050/admin/graphql';

const baseURLenv = window?.__env__?.REACT_APP_BASE_URL || process?.env?.REACT_APP_BASE_URL || '';

export const baseURL = baseURLenv && `/${baseURLenv}`;
