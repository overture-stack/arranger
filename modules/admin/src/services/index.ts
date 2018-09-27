export const serializeToEsId = (id: string): string =>
  id
    .toLowerCase()
    .split('-')
    .join('_');
