import mappingToAggsType from './mappingToAggsType';

export default (mapping) =>
  mappingToAggsType(mapping)
    .map((field) => field.split(':').map((x) => x.trim()))
    .map(([field, type]) => ({
      field,
      type,
      show: false,
      active: true,
    }));
