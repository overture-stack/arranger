export let esToGraphqlTypeMap = {
  keyword: 'String',
  string: 'String',
  text: 'String',
  date: 'String',
  boolean: 'Boolean',
  long: 'Float',
  double: 'Float',
  integer: 'Float',
  float: 'Float',
};

const maybeArray = (field, extendedFields, type) => {
  return extendedFields?.find(x => x.field === field)?.isArray
    ? `[${type}]`
    : type;
};

export default (mapping, extendedFields) => {
  return Object.entries(mapping)
    .filter(([, metadata]) =>
      Object.keys(esToGraphqlTypeMap).includes(metadata.type),
    )
    .map(
      ([field, metadata]) =>
        `${field}: ${maybeArray(
          field,
          extendedFields,
          esToGraphqlTypeMap[metadata.type],
        )}`,
    );
};
