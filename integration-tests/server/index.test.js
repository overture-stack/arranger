//  encodings need to be loaded up front for jest testing
// https://stackoverflow.com/questions/49141927/express-body-parser-utf-8-error-in-test

import encodings from '../../node_modules/iconv-lite/encodings'; // eslint-disable-line
import createServer from '@arranger/server';
import connect from './connect';
import power from './power';
import active from './active';

let port = 5678;
let server = createServer();
server.listen(5678);

// connect();
// power();
active({ server, port });

// afterAll(() => {
//   server.close();
// });
