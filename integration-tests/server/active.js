import createServer from '@arranger/server';
import fetch from 'node-fetch';

let projectId = 'TEST-ACTIVE';
let esHost = 'http://127.0.0.1:9200';

export default server =>
  test('active projects should start at server creation', () => {
    let server = createServer({
      esHost,
    });
    server.listen(7358, async () => {
      let d;
      try {
        d = await fetch('http://localhost:7538/projects/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: { eshost: esHost, id: projectId },
        });
      } catch (error) {
        console.log(123, error);
      }

      console.log(d);

      // server.close();
    });
  });
