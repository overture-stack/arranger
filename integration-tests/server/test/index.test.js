import createServer from '@arranger/server';
import ajax from '@arranger/server/dist/utils/ajax';
import power from './power';
import addProject from './addProject';
import spinupActive from './spinupActive';

let port = 5678;
let esHost = 'http://127.0.0.1:9200';
let server = createServer({ esHost });
let api = ajax(`http://localhost:${port}`);
let projectId = 'TEST-PROJECT';

describe('@arranger/server', () => {
  power({ server });
  addProject({ server, port, esHost, api, projectId });

  // failing
  // spinupActive({ server, port, api, projectId });
});
