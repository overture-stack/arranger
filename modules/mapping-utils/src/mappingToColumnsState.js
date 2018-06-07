import mappingToColumnsType from './mappingToColumnsType';
import { toQuery } from './utils/columnsToGraphql';

export default mapping => {
  return mappingToColumnsType(mapping).map(({ field, type }) => {
    const id = field.replace(/hits\.edges\[\d*\].node\./g, '');

    const sourceField = Object.keys(mapping).find(key =>
      (mapping[key].copy_to || []).includes(field),
    );
    return {
      show: false,
      type,
      sortable: type !== 'list',
      canChangeShow: type !== 'list',
      field: id,
      ...(type === 'list'
        ? {
            query: toQuery({ accessor: sourceField || field }),
            jsonPath: `$.${(sourceField || field).replace(/\[\d*\]/g, '[*]')}`,
          }
        : { accessor: sourceField || field }),
    };
  });
};
