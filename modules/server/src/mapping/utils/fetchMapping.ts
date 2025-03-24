import type { Client } from '@elastic/elasticsearch/api/new';
import type { CatAliasesAliasesRecord } from '@elastic/elasticsearch/api/types';

export const getESAliases = async (esClient: Client) => {
	const { body } = await esClient.cat.aliases({ format: 'json' });

	return body;
};

export const checkESAlias = (aliases: CatAliasesAliasesRecord[], possibleAlias: string) =>
	aliases?.find((foundIndex = { alias: undefined }) => foundIndex.alias === possibleAlias)?.index;

export const fetchMapping = async ({ esClient, index }: { esClient: Client; index: string }) => {
	if (esClient) {
		console.log(`Fetching ES mapping for "${index}"...`);
		const aliases = await getESAliases(esClient);
		const alias = checkESAlias(aliases, index);
		alias && console.log(`  - Found it as an alias for index "${alias}".`);

		const accessor = alias || index;

		const mapping = await esClient?.indices
			.getMapping({
				index: accessor,
			})
			.then((response) => {
				const mappings = response?.body?.[accessor];

				if (mappings) {
					const mapping = mappings?.mappings?.properties;
					return { index: accessor, mappings, mapping, alias };
				}

				console.info(`  - Response could not be used to map "${accessor}":`, response?.body);
				throw new Error(`Could not create a mapping for "${accessor}"`);
			});

		return mapping;
	}

	throw new Error('fetchMapping did not receive an esClient');
};
