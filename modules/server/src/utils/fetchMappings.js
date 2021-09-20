import { fetchMapping } from '../mapping';

export let fetchMappings = ({ types, es }) => {
  return Promise.all(types.map(({ index, name, esType }) => fetchMapping({ index, esType, es })));
};
