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
  // https://github.com/overture-stack/arranger/blob/master/modules/schema/src/index.js#L9
  object: 'JSON',
};

const maybeArray = (field, extendedFields, type, parent) => {
  const fullField = [parent, field].filter(Boolean).join('.');
  return extendedFields?.find((x) => x.field === fullField)?.isArray ? `[${type}]` : type;
};

export default (mapping, extendedFields, parent) => {
  return Object.entries(mapping)
    .filter(([, metadata]) => Object.keys(esToGraphqlTypeMap).includes(metadata.type))
    .map(
      ([field, metadata]) =>
        `${field}: ${maybeArray(field, extendedFields, esToGraphqlTypeMap[metadata.type], parent)}`,
    );
};
