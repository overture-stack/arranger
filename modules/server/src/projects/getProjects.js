import mapHits from '../utils/mapHits';

export async function fetchProjects({ es }) {
  let projects = [];
  let error;
  let arrangerConfig = {
    projectsIndex: {
      index: 'arranger-projects',
      type: 'arranger-projects',
      size: 1000,
    },
  };

  try {
    projects = await es.search(arrangerConfig.projectsIndex);
  } catch (searchError) {
    try {
      await es.indices.create({ index: arrangerConfig.projectsIndex.index });
    } catch (createError) {
      error = createError;
    }
  }
  return error
    ? { error: error.message }
    : {
        projects: mapHits(projects),
        total: projects.hits.total,
      };
}
export default async (req, res) => {
  res.send(await fetchProjects(req.context));
};
