import { get, flatten } from 'lodash';
import through2 from 'through2';
import jsonPath from 'jsonpath';

const getAllValue = data => {
  if (typeof data === 'object') {
    return Object.values(data || {})
      .map(getAllValue)
      .reduce((a, b) => a.concat(b), []);
  } else {
    return data;
  }
};

const getValue = (row, column) => {
  const valueFromExtended = value =>
    (column.extendedDisplayValues || {})[value] || value;
  if (column.jsonPath) {
    return jsonPath
      .query(row, column.jsonPath.split('.hits.edges[*].node.').join('[*].'))
      .map(getAllValue)
      .reduce((a, b) => a.concat(b), [])
      .map(valueFromExtended)
      .join(', ');
  } else if (column.accessor) {
    return valueFromExtended(get(row, column.accessor));
  } else {
    return '';
  }
};

const getRows = args => {
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
            jsonPath: column.field.replace(`${entity.path.join('.')}.`, ''),
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
              field: paths.slice(0, pathIndex + 1).join(''),
              // TODO: don't assume hits.edges.node.
              // .replace(/(\.hits.edges(node)?)/g, ''),
              data: node,
            },
          ],
        });
      }),
    );
  }
};

export const columnsToHeader = ({ columns, fileType = 'tsv' }) => {
  return fileType === 'tsv'
    ? `${columns.map(({ Header }) => Header).join('\t')}\n`
    : fileType === 'json'
      ? `${JSON.stringify(
          columns.reduce(
            (output, { Header, accessor }) => (output[[accessor]] = Header),
            {},
          ),
        )}\n`
      : '';
};

export const dataToTSV = args =>
  transformData({ ...args, rowTransformer: rowToTSV });

export const dataToJSON = ({ columns, ...args }) =>
  transformData({ ...args, columns, rowTransformer: rowToJSON(columns) });

export default ({
  index,
  columns,
  uniqueBy,
  emptyValue = '--',
  fileType = 'tsv',
}) => {
  let isFirst = true;
  let chunkCounts = 0;
  return through2.obj(function({ hits, total }, enc, callback) {
    console.time(`esHitsToTsv_${chunkCounts}`);
    const pipe = this;
    let rows;

    if (fileType === 'tsv') {
      rows = getRowsInTSV({
        index,
        columns,
        uniqueBy,
        emptyValue,
        hits,
        total,
        pipe,
        isFirst,
      });
    } else if (fileType === 'json') {
      rows = getRowsInJSON({
        index,
        columns,
        uniqueBy,
        emptyValue,
        hits,
        total,
        pipe,
        isFirst,
      });
    } else {
      throw new Error('Unsupported file type specified for export.');
    }

    if (rows) {
      this.push(rows);
    }

    if (isFirst) {
      isFirst = false;
    }
    callback();
    console.timeEnd(`esHitsToTsv_${chunkCounts}`);
    chunkCounts++;
  });
};

const transformData = ({
  data: { hits, total },
  index,
  uniqueBy,
  columns,
  emptyValue,
  rowTransformer,
}) =>
  flatten(
    hits.map(row => {
      return getTransformedRow({ row, columns, uniqueBy, emptyValue }).map(
        row => rowTransformer(row, emptyValue),
      );
    }),
  ).join('\n') + '\n';

const getRowsInTSV = ({
  index,
  columns,
  uniqueBy,
  emptyValue = '--',
  hits,
  total,
  pipe,
  isFirst,
}) => {
  if (isFirst) {
    const headerRow = columnsToHeader({ columns, fileType: 'tsv' });
    pipe.push(headerRow);
  }

  return dataToTSV({
    data: { hits, total },
    index,
    uniqueBy,
    columns,
    emptyValue,
  });
};

const getRowsInJSON = ({
  index,
  columns,
  uniqueBy,
  emptyValue = '--',
  hits,
  total,
  pipe,
  isFirst,
}) => {
  if (isFirst) {
    const headerRow = columnsToHeader({ columns, fileType: 'json' });
    pipe.push(headerRow);
  }

  return dataToJSON({
    data: { hits, total },
    index,
    uniqueBy,
    columns,
    emptyValue,
  });
};

const getTransformedRow = ({ row, columns, uniqueBy, emptyValue }) =>
  getRows({
    row: row._source,
    paths: (uniqueBy || '').split('.hits.edges[].node.').filter(Boolean),
    columns: columns,
    emptyValue,
  });

const rowToTSV = ({ row, emptyValue }) =>
  row.map(r => r || emptyValue).join('\t');

const rowToJSON = columns => ({ row, emptyValue }) =>
  row.map(r => r || emptyValue).join('\t');
