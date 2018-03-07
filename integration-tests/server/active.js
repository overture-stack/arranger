import createServer from '@arranger/server';
import ajax from '@arranger/server/dist/utils/ajax';
import fetch from 'node-fetch';
import bodyParser from 'body-parser';
let projectId = 'TEST-ACTIVE';
let port = 5051;
let esHost = 'http://127.0.0.1:9200';
let api = ajax(`http://localhost:${port}`);

export default server =>
  test('active projects should start at server creation', () => {
    let server = createServer();

    server.app.use(bodyParser.json({ limit: '50mb' }));

    server.listen(port, async () => {
      console.log(999, {
        endpoint: 'projects/add',
        body: { eshost: esHost, id: projectId },
      });

      let d;

      try {
        // d = await api({
        //   endpoint: 'projects/add',
        //   body: { eshost: esHost, id: projectId },
        // });

        d = await fetch(`http://localhost:${port}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            eshost: esHost,
            id: projectId,
          }),
        }).then(r => r.text());
      } catch (error) {
        console.log(123, error);
      }

      console.log(d);
      // server.close();
    });
  });
