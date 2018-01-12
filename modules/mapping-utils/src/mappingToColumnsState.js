import { startCase } from 'lodash';
import mappingToColumnsType from './mappingToColumnsType';

function toQuery(path) {
  return path
    .split('.')
    .reverse()
    .reduce((acc, segment, i, arr) => {
      if (segment === 'hits') {
        return `${segment}(first: 5) { total, ${acc} }`;
      } else if (i === 0) {
        return segment;
      } else {
        return `${
          segment.indexOf('edges[') === 0 ? 'edges' : segment
        } { ${acc} }`;
      }
    }, '');
}

export default mapping => {
  return mappingToColumnsType(mapping).map(({ field, type }) => {
    const id = field.replace(/hits\.edges\[\d*\].node\./g, '');

    return {
      show: false,
      Header: startCase(id.replace(/\./g, ' ')),
      type,
      sortable: type !== 'list',
      canChangeShow: type !== 'list',
      ...(type === 'list'
        ? {
            query: toQuery(field),
            listAccessor: field.split(/\[\d*\].node/)[0],
            totalAccessor: `${field.split(/edges\[\d*\].node/)[0]}total`,
            id,
          }
        : { accessor: field }),
    };
  });
};
