import { fetchProjects } from '../projects/getProjects';

const getTypes = async ({ id, es }) => {
  const index = `arranger-projects-${id}`;

  try {
    return (await es.search({ index })).body;
  } catch (error) {
    // We want to automatically create the index when first required in the admin...
    //  But in order to do this we must ensure that an arranger project with this name exists
    //  so here we call fetchProjects and check that the id exists.

    const projectsResponse = await fetchProjects({ es });
    const projects = (projectsResponse.projects || []).map((project) => project.id);
    if (projects.includes(id)) {
      await es.indices.create({ index });
    }
    return null;
  }
};

export default getTypes;
