export const serializeToEsId = (id: string): string =>
  id
    .toLowerCase()
    .split('-')
    .join('_');

export const serializeToGqlField = (field: string): string =>
  field.split('.').join('__');

export const timestamp = () => new Date().toISOString();
