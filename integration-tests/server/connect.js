import elasticsearch from 'elasticsearch';

let projectsIndex = {
  index: 'arranger-projects',
  type: 'arranger-projects',
};

let testProject = 'TEST-PROJECT';

export default () =>
  test('should be able to connect to es', async () => {
    let es = new elasticsearch.Client({
      host: 'http://127.0.0.1:9200',
    });

    expect(es).toBeDefined();

    try {
      await es.create({
        ...projectsIndex,
        refresh: true,
        id: testProject,
        body: {
          id: testProject,
          active: true,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.log(error);
    }

    let projects;

    try {
      projects = await es.search(projectsIndex);
    } catch (error) {
      console.log(error);
    }

    expect(projects).toBeDefined();
  });
