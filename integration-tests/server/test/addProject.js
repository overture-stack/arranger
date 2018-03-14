import { expect } from 'chai';

export default ({ server, api, port, esHost, projectId }) => {
  it('should successfully add a project', done => {
    server.listen(port, async () => {
      try {
        await api.post({
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
        d = await api.post({
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
      done();
    });
  });
};
