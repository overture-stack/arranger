import { fetchMapping } from '#mapping/index.js';

// TODO: unused function? do we still need it? can it be used for new implementation?
export let fetchMappings = ({ types, esClient }) => {
	return Promise.all(types.map(({ index }) => fetchMapping({ index, esClient })));
};
