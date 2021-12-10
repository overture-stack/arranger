import { fetchMapping } from '../mapping';

export let fetchMappings = ({ types, esClient }) => {
  return Promise.all(types.map(({ index }) => fetchMapping({ index, esClient })));
};
