import through2 from 'through2';
import { get, flatten } from 'lodash';

function getAllValue(data) {
  if (typeof data === 'object') {
    return Object.values(data || {})
      .map(getAllValue)
      .reduce((a, b) => a.concat(b), []);
  } else {
    return data;
  }
}

function getValue(row, column) {
  if (column.accessor) {
    return get(row, column.accessor);
  } else if (column.type === 'list') {
    return get(row, column.listAccessor)
      .map(getAllValue)
      .reduce((a, b) => a.concat(b), [])
      .join(', ');
  } else {
    return '';
  }
}

function getRows(args) {
  const {
    row,
    data = row,
    paths,
    pathIndex = 0,
    columns,
    entities = [],
  } = args;
  if (pathIndex >= paths.length - 1) {
    return [
      columns.map(column => {
        const entity = entities
          .slice()
          .reverse()
          .find(entity => column.field.indexOf(entity.field) === 0);

        if (entity) {
          return get(
            entity.data,
            // TODO: don't assume all edges will start with node
            'node.' + column.field.replace(entity.field, '').replace(/^\./, ''),
          );
        } else {
          return getValue(row, column);
        }
      }),
    ];
  } else {
    const currentPath = paths[pathIndex];
    return flatten(
      (get(data, currentPath) || []).map(node => {
        return getRows({
          ...args,
          data: node,
          pathIndex: pathIndex + 1,
          entities: [
            ...entities,
            {
              field: paths
                .slice(0, pathIndex + 1)
                .join('')
                // TODO: don't assume hits.edges.node.
                .replace(/(\.hits.edges(node)?)/g, ''),
              data: node,
            },
          ],
        });
      }),
    );
  }
}

export default function(args) {
  let isFirst = true;

  return through2.obj(function(chunk, enc, callback) {
    if (isFirst) {
      isFirst = false;
      this.push(args.columns.map(column => column.Header).join('\t') + '\n');
    }

    this.push(
      flatten(
        chunk.data[args.index].hits.edges.map(e => e.node).map(row => {
          return getRows({
            row,
            paths: args.uniqueBy.split('[].').filter(Boolean),
            columns: args.columns,
          }).map(row => row.join('\t'));
        }),
      ).join('\n'),
    );

    callback();
  });
}
