import { Client } from 'elasticsearch';
import { serializeToEsId } from '../../services';

export const ARRANGER_PROJECT_INDEX = 'arranger-projects';
export const ARRANGER_PROJECT_TYPE = 'arranger-projects';

export interface IArrangerProject {
  id: string;
  active: boolean;
  timestamp: string;
}

export const newArrangerProject = (id: string): IArrangerProject => ({
  id: serializeToEsId(id),
  active: true,
  timestamp: new Date().toISOString(),
});

export const getArrangerProjects = async (
  es: Client,
): Promise<Array<IArrangerProject>> => {
  const {
    hits: { hits },
  } = await es.search({
    index: ARRANGER_PROJECT_INDEX,
    type: ARRANGER_PROJECT_TYPE,
  });
  return hits.map(({ _source }) => _source as IArrangerProject);
};

export const addArrangerProject = (es: Client) => async (
  id: string,
): Promise<IArrangerProject> => {
  //id must be lower case
  const _id = serializeToEsId(id);
  const newProject = newArrangerProject(_id);
  return es
    .create({
      index: ARRANGER_PROJECT_INDEX,
      type: ARRANGER_PROJECT_TYPE,
      id: _id,
      body: newProject,
    })
    .then(() => newProject)
    .catch(Promise.reject);
};

export const removeArrangerProject = (es: Client) => async (
  id: string,
): Promise<IArrangerProject> => {
  const existingProject = (await getArrangerProjects(es)).find(
    ({ id: _id }) => id === _id,
  );
  if (existingProject) {
    await es.delete({
      index: ARRANGER_PROJECT_INDEX,
      type: ARRANGER_PROJECT_TYPE,
      id: id,
    });
    return existingProject;
  } else {
    return Promise.reject(`No project with id ${id} was found`);
  }
};
