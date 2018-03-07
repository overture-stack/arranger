import mapHits from '../utils/mapHits';
import getIndexPrefix from '../utils/getIndexPrefix';

export default async (req, res) => {
  let { es } = req.context;
  let { id, index } = req.params;

  if (!id) return res.json({ error: 'id cannot be empty' });
  if (!index) return res.json({ error: 'index cannot be empty' });

  // indices must be lower cased
  id = id.toLowerCase();
  index = index.toLowerCase();

  let projects = [];

  let arrangerConfig = {
    projectsIndex: {
      index: `arranger-projects`,
      type: `arranger-projects`,
    },
  };

  try {
    await es.delete({
      index: `arranger-projects-${id}`,
      type: `arranger-projects-${id}`,
      refresh: true,
      id: index,
    });
    await es.indices.delete({
      index: `${getIndexPrefix({ projectId: id, index })}*`,
    });
  } catch (error) {
    return res.json({ error: error.message });
  }

  try {
    projects = await es.search({
      ...arrangerConfig.projectsIndex,
      size: 1000,
    });
  } catch (error) {
    try {
      await es.indices.create({
        index: arrangerConfig.projectsIndex.index,
      });
      return res.json({ projects, total: 0 });
    } catch (error) {
      return res.json({ error: error.message });
    }
  }

  res.json({ projects: mapHits(projects), total: projects.hits.total });
};
