import { get } from 'lodash';
import { createWriteStream, supported } from 'streamsaver';
import { saveAs } from 'filesaver.js';
import { getSingleValue } from '../utils';

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

export default function({
  columns,
  streamData,
  shouldStream = supported,
  fileName = 'file.txt',
}) {
  const { onData, onEnd } = shouldStream
    ? streamMethods(fileName)
    : noStreamMethods(fileName);
  const columnsShowing = columns.filter(c => c.show);
  const data = columnsShowing.map(column => column.Header).join('\t');
  onData(data + '\n');

  streamData({
    sort: [],
    first: 1000,
    onData: chunk => {
      const data = chunk.data
        .map(row =>
          columnsShowing
            .map(column => {
              if (column.accessor) {
                return get(row, column.accessor);
              } else if (column.type === 'list') {
                return get(row, column.listAccessor)
                  .map(getSingleValue)
                  .join();
              } else {
                return '';
              }
            })
            .join('\t'),
        )
        .join('\n');

      onData(data + '\n');
    },
    onEnd,
  });
}
