import { expect } from 'chai';
import ajax from '@arranger/server/dist/utils/ajax';

export default ({ server, port }) => {
  let projectId = 'TEST-ACTIVE';
  let esHost = 'http://127.0.0.1:9200';
  let api = ajax(`http://localhost:${port}`);

  it('active projects should start at server creation', () => {
    server.listen(port, async () => {
      let projects;

      try {
        projects = await api({
          endpoint: 'projects',
          body: { eshost: esHost },
        });
      } catch (error) {
        console.warn(error.message);
      }

      try {
        await api({
          endpoint: `projects/${projectId}/delete`,
          body: {
            eshost: esHost,
            id: projectId,
          },
        });
      } catch (error) {
        console.warn(error.message);
      }

      let d;
      try {
        d = await api({
          endpoint: 'projects/add',
          body: { eshost: esHost, id: projectId },
        });
      } catch (error) {
        console.warn(error.message);
      }

      expect(d.projects.find(x => x.id === projectId)).to.be.undefined;
      expect(
        d.projects.find(x => x.id === projectId.toLowerCase()).id,
      ).to.equal(projectId.toLowerCase());

      server.close();
    });
  });
};
