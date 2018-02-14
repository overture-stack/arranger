import { get, flatten } from 'lodash';
// streamsaver uses ES6 and fails to minify, removing for now.
// import { createWriteStream, supported } from 'streamsaver';
import { saveAs } from 'file-saver';

import { getAllValue } from '../utils';

const supported = false;
const createWriteStream = () => {};

function streamMethods(fileName) {
  const fileStream = createWriteStream(fileName);
  const writer = fileStream.getWriter();
  const encoder = new TextEncoder();

  return {
    onData: data => {
      let uint8array = encoder.encode(data);
      writer.write(uint8array);
    },
    onEnd: () => {
      writer.close();
    },
  };
}

function noStreamMethods(fileName) {
  let data = '';
  return {
    onData: chunk => {
      data = data + chunk;
    },
    onEnd: () => {
      saveAs(new Blob([data], { type: 'text/tab-separated-values' }), fileName);
    },
  };
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
    return columns.map(column => {
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
    });
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

export default function({
  columns,
  streamData,
  shouldStream = supported,
  fileName = 'file.txt',
  uniqueBy = '',
  sqon,
}) {
  const { onData, onEnd } = shouldStream
    ? streamMethods(fileName)
    : noStreamMethods(fileName);
  const columnsShowing = columns.filter(c => c.show);
  const data = columnsShowing.map(column => column.Header).join('\t');
  onData(data + '\n');

  return streamData({
    columns: columnsShowing,
    sort: [],
    first: 1000,
    sqon,
    onData: chunk => {
      const data = chunk.data
        .map(row => {
          return flatten(
            getRows({
              row,
              paths: uniqueBy.split('[].').filter(Boolean),
              columns: columnsShowing,
            }),
          ).join('\t');
        })
        .join('\n');

      onData(data + '\n');
    },
    onEnd,
  });
}
