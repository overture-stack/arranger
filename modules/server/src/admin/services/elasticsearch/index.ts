import getSearchClient from '#searchClient/index.js';
import { type SearchClient } from '#searchClient/types.js';

import { type EsMapping } from './types.js';

export const createClient = async (esHost: string, esUser: string, esPass: string) => {
	const esConf = { node: esHost };
	if (esUser && esPass) {
		esConf['auth'] = {
			username: esUser,
			password: esPass,
		};
	}
	return await getSearchClient(esConf);
};

export const getEsMapping =
	(es: SearchClient) =>
	async ({
		esIndex,
	}: {
		esIndex: string;
		esType?: string; //deprecated
	}): Promise<EsMapping> => {
		const response = await es.indices.getMapping({
			index: esIndex,
		});
		return response.body as EsMapping;
	};
