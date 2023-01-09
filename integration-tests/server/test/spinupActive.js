import { expect } from 'chai';

export default ({ server, projectId, port, api }) =>
  it(`should register active projects' ping/graphql endpoints`, (done) => {
    server.listen(port, async () => {
      let response = await api.get({
        endpoint: `${projectId}/ping`,
        then: (r) => r.text(),
      });
      expect(response).to.equal('ok');
      server.close();
      done();
    });
  });
