import { get } from 'lodash';
import through2 from 'through2';
import { DOWNLOAD_STREAM_BUFFER_SIZE } from '../utils/config';

const getRow = ({ rowModel }) =>
  `${rowModel.map(({ value }) => value).join('\t')}\n`;

const toRowModel = ({ columns, emptyValue }) => ({ _source }) =>
  columns.reduce((acc, { field, Header }) => {
    const value = get(_source, field);
    acc.push({ Header, field, value: value || emptyValue });
    return acc;
  }, []);

export default ({
  index,
  columns,
  sort,
  sqon,
  chunkSize = DOWNLOAD_STREAM_BUFFER_SIZE,
  fileName,
  mock,
  emptyValue = '--',
}) => {
  let isFirst = true;
  let chunkCounts = 0;
  return through2.obj(function({ hits, total }, enc, callback) {
    console.time(`esHitsToTsv_${chunkCounts}`);
    const pipe = this;
    const rowModels = hits.map(toRowModel({ columns, emptyValue }));
    if (isFirst) {
      isFirst = false;
      const headerRow = `${columns.map(({ Header }) => Header).join('\t')}\n`;
      pipe.push(headerRow);
    }
    rowModels.forEach(rowModel => {
      const row = getRow({ rowModel });
      if (row) {
        pipe.push(row);
      }
    });

    callback();
    console.timeEnd(`esHitsToTsv_${chunkCounts}`);
    chunkCounts++;
  });
};
