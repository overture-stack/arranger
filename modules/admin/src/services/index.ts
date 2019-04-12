export const serializeToEsId = (id: string): string =>
  id
    .toLowerCase()
    .split('-')
    .join('_');

export const serializeToGqlField = (field: string): string =>
  field.split('.').join('__');

export const timestamp = () => new Date().toISOString();

export const replaceBy = <T>(
  arr1: Array<T>,
  arr2: Array<T>,
  operator: (entry1: T, entry2: T) => boolean,
): Array<T> => {
  const cArr1 = arr1 || [];
  const cArr2 = arr2 || [];
  // return cArr1.map(x => cArr2.find(y => operator(x, y)) || x);
  // console.log('cArr1: ', cArr1);
  // console.log('cArr2: ', cArr2);
  return [
    ...cArr2.filter(x => cArr1.find(y => operator(x, y))),
    ...cArr1.filter(x => !cArr2.find(y => operator(x, y))),
  ];
};
