import download from '../../utils/download';

export default async function({
  url,
  files = [],
  fileName,
  options = {},
  callback = () => {},
}) {
  return download({
    url,
    method: 'POST',
    ...options,
    params: {
      fileName,
      files: files.map(({ columns, ...file }, i) => {
        return {
          ...file,
          columns: columns.filter(c => c.show),
        };
      }),
      ...options.params,
    },
    callback,
  });
}
