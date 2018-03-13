import createServer from '@arranger/server';
import connect from './connect';
import power from './power';
import active from './active';

let port = 5678;
let server = createServer();

describe('@arranger/server', () => {
  connect();
  power({ server });
  active({ server, port });
});
