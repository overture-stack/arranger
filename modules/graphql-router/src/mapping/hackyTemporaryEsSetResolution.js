// due to this problem in Elasticsearch 6.2 https://github.com/elastic/elasticsearch/issues/27782,
// we have to resolve set ids into actual ids. Once the issue is resolved
// by Elasticsearch in version 6.3, we no longer need these functions here.

// TODO: evaluate this ^^^^^^

import { flattenDeep, isArray, zipObject } from 'lodash-es';

import fallbackConfigs from '#config/index.js';

import esSearch from './utils/esSearch.js';

const resolveSetIdsFromEs = (esClient) => (setId) =>
	esSearch(esClient)({
		index: fallbackConfigs.sets.index, // TODO: trickle from passed in configs
		body: {
			query: {
				bool: {
					must: { match: { setId } },
				},
			},
		},
	}).then(({ hits: { hits } }) => flattenDeep(hits.map(({ _source: { ids } }) => ids)));

const extractSetIds = (sqon) => {
	if (!sqon || typeof sqon !== 'object') return [];

	if (isArray(sqon.content)) {
		return flattenDeep(sqon.content.map(extractSetIds));
	}

	const raw = sqon.content?.value;
	const values = isArray(raw) ? raw : [raw];
	return values.filter((v) => String(v).startsWith('set_id:')).map((v) => String(v).replace('set_id:', ''));
};

const expandSetValue = (value, setIdsToValueMap) => {
	const replacement = setIdsToValueMap[value];
	return replacement || value;
};

const injectIdsIntoSqon = ({ sqon, setIdsToValueMap }) => {
	if (!sqon || typeof sqon !== 'object') return sqon;

	// group node
	if (isArray(sqon.content)) {
		return {
			...sqon,
			content: sqon.content.map((child) => injectIdsIntoSqon({ sqon: child, setIdsToValueMap })),
		};
	}

	// leaf node
	const value = sqon.content?.value;
	return {
		...sqon,
		content: {
			...sqon.content,
			value: isArray(value)
				? flattenDeep(value.map((v) => expandSetValue(v, setIdsToValueMap)))
				: expandSetValue(value, setIdsToValueMap),
		},
	};
};

export const resolveSetsInSqon = ({ sqon, esClient }) => {
	const setIds = extractSetIds(sqon || {});
	return setIds.length
		? Promise.all(setIds.map(resolveSetIdsFromEs(esClient))).then((searchResult) => {
				const setIdsToValueMap = zipObject(
					setIds.map((id) => `set_id:${id}`),
					searchResult,
				);
				return injectIdsIntoSqon({ sqon, setIdsToValueMap });
			})
		: sqon;
};
