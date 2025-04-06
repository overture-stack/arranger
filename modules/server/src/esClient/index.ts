import { Client, type ClientOptions } from '@elastic/elasticsearch';

export const buildEsClient = (esHost = '', esUser = '', esPass = '') => {
	if (!esHost) {
		console.error('no elasticsearch host was provided');
	}

	const esConfig: ClientOptions = {
		node: esHost,
	};

	if (esUser) {
		if (!esPass) {
			console.error('ES user was defined, but password was not');
		}
		esConfig['auth'] = {
			username: esUser,
			password: esPass,
		};
	}

	return new Client(esConfig);
};

export const buildEsClientViaEnv = (ES_HOST: string, ES_USER: string, ES_PASS: string) => {
	return buildEsClient(ES_HOST, ES_USER, ES_PASS);
};
