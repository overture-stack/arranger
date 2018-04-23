const defaults = {
  isActive: false,
  keyField: null,
  searchFields: [],
};

export default ({ name, extendedFields, ...mapping }) => [
  {
    displayName: name,
    field: '',
    ...defaults,
  },
  ...extendedFields
    .filter(x => x.type === 'nested')
    .map(({ field, displayName }) => ({
      displayName,
      field,
      ...defaults,
    })),
];
