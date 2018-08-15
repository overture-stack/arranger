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
      .query(
        row,
        column.jsonPath.replace('.hits.edges', '').replace('[*].node', '[*]'),
      )
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
  return columns.map(column => {
    const value = getValue(row, column);
    return value;
  });
};

const dataToTSV = ({
  data: { hits, total },
  index,
  uniqueBy,
  columns,
  emptyValue,
}) =>
  hits
    .map(row => {
      return getRows({
        row: row._source,
        paths: (uniqueBy || '').split('[].').filter(Boolean),
        columns: columns,
        emptyValue,
      });
    })
    .map(row => row.map(r => r || emptyValue).join('\t'))
    .join('\n') + '\n';

export default ({ index, columns, uniqueBy, emptyValue = '--' }) => {
  let isFirst = true;
  let chunkCounts = 0;
  return through2.obj(function({ hits, total }, enc, callback) {
    console.time(`esHitsToTsv_${chunkCounts}`);
    const pipe = this;
    if (isFirst) {
      isFirst = false;
      const headerRow = `${columns.map(({ Header }) => Header).join('\t')}\n`;
      pipe.push(headerRow);
    }

    const rows = dataToTSV({
      data: { hits, total },
      index,
      uniqueBy,
      columns,
      emptyValue,
    });

    if (rows) {
      this.push(rows);
    }

    callback();
    console.timeEnd(`esHitsToTsv_${chunkCounts}`);
    chunkCounts++;
  });
};
