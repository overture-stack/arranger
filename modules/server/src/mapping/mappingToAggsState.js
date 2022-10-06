import mappingToAggsType from './mappingToAggsType';

export default (mapping) =>
  mappingToAggsType(mapping)
    .map((fieldName) => fieldName.split(':').map((segment) => segment.trim()))
    .map(([fieldName, type]) => ({
      fieldName,
      type,
      show: false,
      active: true,
    }));
