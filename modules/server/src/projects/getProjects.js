import mapHits from '../utils/mapHits';
import esSearch from '@arranger/mapping-utils/dist/utils/esSearch';

export async function fetchProjects({ es }) {
  let arrangerConfig = {
    projectsIndex: {
      index: 'arranger-projects',
      size: 1000,
    },
  };

  try {
    const projects = await esSearch(es)(arrangerConfig.projectsIndex);
    return {
      projects: mapHits(projects),
      total: projects.hits.total.value,
    };
  } catch (searchError) {
    try {
      await es.indices.create({ index: arrangerConfig.projectsIndex.index });
      return { projects: [], total: 0 };
    } catch (createError) {
      return { error: createError.message };
    }
  }
}

export default async (req, res) => {
  res.send(await fetchProjects(req.context));
};
