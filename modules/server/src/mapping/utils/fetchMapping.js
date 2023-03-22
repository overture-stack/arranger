import { ES_USER, ES_PASS } from '@/config/constants';

export const getESAliases = async (esClient) => {
	const { body } = await esClient?.cat.aliases({ format: 'json' });

	return body;
};

export const checkESAlias = (aliases, possibleAlias) =>
	aliases?.find((foundIndex = { alias: undefined }) => foundIndex.alias === possibleAlias)?.index;

export const fetchMapping = async ({ esClient, index }) => {
	if (esClient) {
		console.log(`  Fetching ES mapping for "${index}"...`);
		const aliases = await getESAliases(esClient);
		const alias = checkESAlias(aliases, index);
		alias && console.log(`Found it as an alias for index "${alias}".`);

		const accessor = alias || index;

		return esClient?.indices
			.getMapping({
				index: accessor,
			})
			.catch((error) => {
				console.error(error?.message || error);
				ES_USER || ES_PASS || console.info('  Posible cause: ES Auth parameters may be missing.');
				// TODO: analyse returning something more useful than false
				return false;
			})
			.then((response) => {
				const mappings = response?.body?.[accessor];

				if (mappings) {
					const mapping = mappings?.mappings?.properties;
					return { index: accessor, mappings, mapping, alias };
				}

				console.info(`Response could not be used to map "${accessor}":`, response?.body);
				throw new Error(`Could not create a mapping for "${accessor}"`);
			});
	}

	throw new Error('fetchMapping did not receive an esClient');
};
