import mappingToColumnsType from './mappingToColumnsType';
import { toQuery } from './utils/columnsToGraphql';

export default (mapping) => {
  return mappingToColumnsType(mapping).map(({ field, type }) => {
    const id = field.replace(/hits\.edges\[\d*\].node\./g, '');

    return {
      show: false,
      type,
      sortable: type !== 'list',
      canChangeShow: type !== 'list',
      field: id,
      ...(type === 'list'
        ? {
            query: toQuery({ accessor: field }),
            jsonPath: `$.${field.replace(/\[\d*\]/g, '[*]')}`,
          }
        : { accessor: field }),
    };
  });
};
