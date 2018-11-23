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
          columns.reduce((output, { Header, accessor }) => {
            output[[accessor]] = Header;
            return output;
          }, {}),
        )}`
      : '';
};

export const dataToTSV = args =>
  transformData({ ...args, dataTransformer: transformDataToTSV });

export const dataToJSON = args =>
  transformData({
    ...args,
    dataTransformer: transformDataToJSON,
  });

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

    dataToStream({
      index,
      columns,
      uniqueBy,
      emptyValue,
      hits,
      total,
      pipe,
      isFirst,
      fileType,
    });
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
  dataTransformer,
  rowSeparator = '\n',
  pipe,
}) => {
  hits
    .map(row => dataTransformer({ row, uniqueBy, columns, emptyValue, pipe }))
    .forEach(transformedRow => {
      pipe.push(`${transformedRow}${rowSeparator}`);
    });
};

const transformDataToTSV = ({ row, uniqueBy, columns, emptyValue }) => {
  return getRows({
    row: row._source,
    paths: (uniqueBy || '').split('.hits.edges[].node.').filter(Boolean),
    columns: columns,
    emptyValue,
  }).map(r => rowToTSV({ row: r, emptyValue }));
};

const transformDataToJSON = ({ row, uniqueBy, columns, emptyValue }) => {
  return rowToJSON({
    row: row._source,
    paths: (uniqueBy || '').split('.hits.edges[].node.').filter(Boolean),
    columns: columns,
    emptyValue,
  });
};

const dataToStream = ({
  index,
  columns,
  uniqueBy,
  emptyValue = '--',
  hits,
  total,
  pipe,
  isFirst,
  fileType = 'tsv',
}) => {
  if (isFirst) {
    const headerRow = columnsToHeader({ columns, fileType });
    pipe.push(headerRow);
  }

  const args = {
    data: { hits, total },
    index,
    uniqueBy,
    columns,
    emptyValue,
    pipe,
  };

  // transform and stream data
  if (fileType === 'tsv') {
    dataToTSV(args);
  } else if (fileType === 'json') {
    dataToJSON(args);
    pipe.on('finish', (...args) => console.log('finish', args));
  } else {
    throw new Error('Unsupported file type specified for export.');
  }
};

const rowToTSV = ({ row, emptyValue }) =>
  row.map(r => r || emptyValue).join('\t');

/*
example args:
{ row:                                                                                                                                         [250/1767]
   { name: 'HCM-dddd-0000-C00',                                                                                                                               
     type: '2-D: Conditionally reprogrammed cells',                                                                                                           
     growth_rate: 5,                                                                                                                                          
     files: [],
     clinical_diagnosis: { clinical_tumor_diagnosis: 'Colorectal cancer' },
     variants: [ [Object], [Object], [Object] ]
    },
  paths: [],
  columns:
   [ { field: 'name',
       accessor: 'name',
       show: true,
       type: 'entity',
       sortable: true,
       canChangeShow: true,
       query: null,
       jsonPath: null,
       Header: 'Name',
       extendedType: 'keyword',
       extendedDisplayValues: {},
       hasCustomType: true,
       minWidth: 140 },
       { field: 'split_ratio',
       accessor: 'split_ratio',
       show: true,
       type: 'string',
       sortable: true,
       canChangeShow: true,
       query: null,
       jsonPath: null,
       Header: 'Split Ratio',
       extendedType: 'keyword',
       extendedDisplayValues: {},
       hasCustomType: false } ],
  emptyValue: '--' }
*/
const rowToJSON = args => {
  const {
    row,
    data = row,
    paths,
    pathIndex = 0,
    columns,
    emptyValue,
    entities = [],
  } = args;
  return `${JSON.stringify(
    (columns || []).filter(col => col.show).reduce((output, col) => {
      output[[col.accessor]] = row[col.accessor] || emptyValue;
      return output;
    }, {}),
  )}`;
};
