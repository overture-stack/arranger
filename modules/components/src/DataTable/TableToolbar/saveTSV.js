import urlJoin from 'url-join';

import { ARRANGER_API, PROJECT_ID } from '../../utils/config';
import download from '../../utils/download';

export default async function({ files = [], fileName }) {
  return download({
    url: urlJoin(ARRANGER_API, `/${PROJECT_ID}/download`),
    method: 'POST',
    params: {
      fileName,
      files: files.map(({ columns, ...file }, i) => {
        return {
          ...file,
          columns: columns.filter(c => c.show),
        };
      }),
    },
  });
}
