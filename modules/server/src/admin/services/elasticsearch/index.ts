import SearchClient, { type SearchClientType } from '#searchClient/index.js';

import { type EsMapping } from './types.js';

export const createClient = (esHost: string, esUser: string, esPass: string) => {
	const esConf = { node: esHost };
	if (esUser && esPass) {
		esConf['auth'] = {
			username: esUser,
			password: esPass,
		};
	}
	return SearchClient(esConf);
};

export const getEsMapping =
	(es: SearchClientType) =>
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
