import createServer from '@arranger/server';
import connect from './connect';
import power from './power';

let server;

beforeAll(() => {
  server = createServer();
  server.listen(5678);
});

connect();
power();

afterAll(() => {
  server.close();
});
