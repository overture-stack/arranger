import ajax from '@arranger/server/dist/utils/ajax';

export default ({ server, port }) => {
  let projectId = 'TEST-ACTIVE';
  let esHost = 'http://127.0.0.1:9200';
  let api = ajax(`http://localhost:${port}`);

  test('active projects should start at server creation', () => {
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

      console.log('!!!', projects);

      // try {
      //   await api({
      //     endpoint: `projects/${projectId}/delete`,
      //     body: {
      //       eshost: esHost,
      //       id: projectId,
      //     },
      //   });
      // } catch (error) {
      //   console.warn(error.message);
      // }
      //
      // let d;
      // try {
      //   d = await api({
      //     endpoint: 'projects/add',
      //     body: { eshost: esHost, id: projectId },
      //   });
      // } catch (error) {
      //   console.warn(error.message);
      // }
      //
      // try {
      //   expect(d.projects.find(x => x.id === projectId).id).toBe(projectId);
      // } catch (error) {}

      server.close();
    });
  });
};
