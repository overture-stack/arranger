import through2 from 'through2';
import { get, flatten } from 'lodash';
import jsonPath from 'jsonpath';

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
  const valueFromExtended = value =>
    (column.extendedDisplayValues || {})[value] || value;
  if (column.jsonPath) {
    return jsonPath
      .query(row, column.jsonPath)
      .map(getAllValue)
      .reduce((a, b) => a.concat(b), [])
      .map(valueFromExtended)
      .join(', ');
  } else if (column.accessor) {
    return valueFromExtended(get(row, column.accessor));
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
          return getValue(entity.data, {
            ...column,
            jsonPath: column.jsonPath.replace(
              `${entity.path.join('[*].')}[*].`,
              '',
            ),
          });
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
              path: paths.slice(0, pathIndex + 1),
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

export function columnsToHeader({ columns }) {
  return columns.map(column => column.Header).join('\t') + '\n';
}

export function dataToTSV({ data, index, uniqueBy, columns, emptyValue }) {
  return (
    flatten(
      get(data, `data['${index}'].hits.edges`, []).map(row => {
        return getRows({
          row: row.node,
          paths: (uniqueBy || '').split('[].').filter(Boolean),
          columns: columns,
        }).map(row => row.map(r => r || emptyValue).join('\t'));
      }),
    ).join('\n') + '\n'
  );
}

export default function({ columns, index, uniqueBy, emptyValue = '--' }) {
  let isFirst = true;

  return through2.obj(function(data, enc, callback) {
    if (isFirst) {
      isFirst = false;
      this.push(columnsToHeader({ columns }));
    }

    const rows = dataToTSV({ data, index, uniqueBy, columns, emptyValue });

    if (rows) {
      this.push(rows);
    }

    callback();
  });
}
