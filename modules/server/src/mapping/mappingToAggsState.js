import mappingToAggsType from './mappingToAggsType';

export default (mapping) =>
  mappingToAggsType(mapping)
    .map((field) => field.split(':').map((x) => x.trim()))
    .map(([fieldName, type]) => ({
      fieldName,
      type,
      show: false,
      active: true,
    }));
