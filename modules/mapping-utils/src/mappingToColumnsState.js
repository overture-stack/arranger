import mappingToColumnsType from './mappingToColumnsType';
import { toQuery } from './utils/columnsToGraphql';

export default mapping => {
  return mappingToColumnsType(mapping).map(({ field, type }) => {
    const id = field.replace(/hits\.edges\[\d*\].node\./g, '');

    let sourceFields = [];
    const findCopyTo = (m, path = '') =>
      Object.keys(m).forEach(
        k =>
          m[k].type === 'nested'
            ? findCopyTo(m[k].properties, k)
            : (m[k].copy_to || []).includes(field) &&
              sourceFields.push(path ? `${path}.hits.edges.node.${k}` : k),
      );
    findCopyTo(mapping);
    return {
      show: false,
      type,
      sortable: type !== 'list',
      canChangeShow: type !== 'list',
      field: id,
      sourceFields,
      ...(type === 'list' || sourceFields.length
        ? {
            query: sourceFields.length
              ? `${sourceFields
                  .map(sField => toQuery({ accessor: sField }))
                  .join(' ')}`
              : toQuery({ accessor: field }),
            jsonPath: `$.${field.replace(/\[\d*\]/g, '[*]')}`,
          }
        : { accessor: field }),
    };
  });
};
