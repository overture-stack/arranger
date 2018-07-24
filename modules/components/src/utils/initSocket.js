import urlParse from 'url-parse';
import urlJoin from 'url-join';
import resolveURL from 'resolve-url';
import io from 'socket.io-client';

import { ARRANGER_API } from '../utils/config';

export default ({
  socket,
  socketConnectionString = 'http://localhost:5051',
  socketOptions,
} = {}) => {
  const arrangerUrl = urlParse(resolveURL(ARRANGER_API));

  return (
    socket ||
    io(socketConnectionString || arrangerUrl.origin, {
      path: urlJoin(arrangerUrl.pathname, 'socket.io'),
      query: {
        type: 'ARRANGER_UI',
        ...(socketOptions?.query || {}),
      },
      ...(socketOptions || {}),
    })
  );
};
