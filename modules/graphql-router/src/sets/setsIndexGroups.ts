import type { ConfigsObject } from '@overture-stack/arranger-types/configs';
import {
	configFeatureFlagProperties,
	configOptionalProperties,
	configRootProperties,
	setsProperties,
} from '@overture-stack/arranger-types/configs/constants';

import { getIndexMapping, type SearchClient } from '#searchClient/index.js';

import { resolveSetsIndex, type SetsIndexResolution } from './resolveSetsIndex.js';

/** A catalogue another catalogue's saved sets may be stored beside, in the same sets index. */
export type SetsIndexPeer = Readonly<{ catalogueId: string; documentType?: string }>;

/**
 * What is known of one configured catalogue when sets indexes are grouped. `configuredIndex` is what its own config
 * names, and `loaded` is whether its data index was read. `derivedIndex` is the index its config alone implies, which
 * is what a catalogue that did not load is taken to hold: its own `sets.index`, else the legacy shared index, else its
 * default name. `legacyName` is the index 3.0 saved every catalogue's sets in: the value of ES_ARRANGER_SETS_INDEX where
 * set, otherwise "arranger-sets". `resolution` is set only for a catalogue that loaded and has saved sets enabled.
 */
export type SetsCatalogueSource = Readonly<{
	catalogueId: string;
	configuredIndex?: string;
	derivedIndex: string;
	documentType?: string;
	legacyName: string;
	loaded: boolean;
	resolution?: SetsIndexResolution;
}>;

/** The index 3.0 saved every catalogue's sets in, where ES_ARRANGER_SETS_INDEX names none. */
const DEFAULT_LEGACY_NAME = 'arranger-sets';

/** The index a catalogue holds its sets in, where it is known: from its resolution, or from its config if it did not load. */
const indexOf = (source: SetsCatalogueSource): string | undefined =>
	source.loaded ? (source.resolution?.kind === 'index' ? source.resolution.index : undefined) : source.derivedIndex;

/**
 * Whether another catalogue could hold saved sets in the same index as `source`, as far as configuration alone shows.
 * A catalogue naming the same `sets.index` always could. Where `source` is in the index 3.0 saved every catalogue's sets
 * in, every catalogue naming no `sets.index` could, whether loaded or not and whatever its sets flag, since 3.0 wrote
 * all of them there. Otherwise a catalogue naming no index could hold it only where its own index is known to be it: a
 * loaded one by its resolution, a failed one by the index its config implies.
 */
const mayShareIndex = (source: SetsCatalogueSource, other: SetsCatalogueSource, index: string): boolean => {
	if (other.configuredIndex !== undefined) {
		return other.configuredIndex === index;
	}

	if (index === source.legacyName) {
		return true;
	}

	return other.loaded ? indexOf(other) === index : other.derivedIndex === index;
};

/**
 * The catalogues that may share saved sets with each functional catalogue, for every configured catalogue. A
 * catalogue without a resolution has none, since its index is not known. Which other catalogues count is
 * `mayShareIndex`'s rule: in the index 3.0 saved every catalogue's sets in, every catalogue naming no index counts.
 *
 * @param sources every configured catalogue, loaded or not.
 * @returns each catalogue's id, mapped to its possible sharers, the other catalogues with their documentTypes.
 */
export const groupSetsIndexes = (sources: readonly SetsCatalogueSource[]): Record<string, SetsIndexPeer[]> =>
	Object.fromEntries(
		sources.map((source) => {
			const index = indexOf(source);

			const peers =
				source.loaded && index !== undefined
					? sources
							.filter(
								(other) =>
									other.catalogueId !== source.catalogueId && mayShareIndex(source, other, index),
							)
							.map(({ catalogueId, documentType }) => ({ catalogueId, documentType }))
					: [];

			return [source.catalogueId, peers];
		}),
	);

/** A catalogue as the search server hands it over: its id, its configs, and whether saved sets have owners. */
export type SetsPlanCatalogue = Readonly<{
	catalogueId: string;
	configs: Partial<ConfigsObject<any>>;
	owned: boolean;
}>;

/**
 * Whether a catalogue's data index can be read, which is what makes it loaded for sets: a catalogue whose read fails
 * gets no sets check, create or mapping update.
 */
const dataIndexLoads = (esClient: SearchClient, configs: Partial<ConfigsObject<any>>, enableDebug: boolean) =>
	getIndexMapping({
		enableDebug,
		esIndex: configs[configRootProperties.ES_INDEX] ?? '',
		nestingPrefix: configs[configOptionalProperties.NESTING_PREFIX],
		searchClient: esClient,
	}).then(
		() => true,
		() => false,
	);

/**
 * Plans the sets index of every catalogue before any router is built: each catalogue's data index is read, each one
 * that loaded with saved sets enabled is resolved, and the catalogues are grouped by the indexes they may share.
 * Reading the data index twice, once here and once by its router, is the cost of having every catalogue's index known
 * before any router is built.
 *
 * @param details the catalogues, the search client they share, and whether to debug-log the reads.
 * @returns each catalogue's loaded state, its resolution (undefined where it did not load or has saved sets disabled)
 *   and its peers.
 */
export const planSetsIndexes = async ({
	catalogues,
	enableDebug = false,
	esClient,
}: {
	catalogues: readonly SetsPlanCatalogue[];
	enableDebug?: boolean;
	esClient: SearchClient;
}): Promise<Record<string, { loaded: boolean; peers: SetsIndexPeer[]; resolution?: SetsIndexResolution }>> => {
	const sources: SetsCatalogueSource[] = await Promise.all(
		catalogues.map(async ({ catalogueId, configs, owned }) => {
			const loaded = await dataIndexLoads(esClient, configs, enableDebug);
			const configuredIndex = configs.sets?.[setsProperties.INDEX];
			const resolution =
				loaded && configs[configFeatureFlagProperties.ENABLE_SETS]
					? await resolveSetsIndex({
							catalogueId,
							configs,
							esClient,
							label: catalogueId,
							owned,
						})
					: undefined;

			return {
				catalogueId,
				configuredIndex,
				derivedIndex:
					configuredIndex ??
					configs.sets?.[setsProperties.LEGACY_SHARED_INDEX] ??
					`arranger-sets-${catalogueId}`,
				documentType: configs[configRootProperties.DOCUMENT_TYPE],
				legacyName: configs.sets?.[setsProperties.LEGACY_SHARED_INDEX] ?? DEFAULT_LEGACY_NAME,
				loaded,
				resolution,
			};
		}),
	);
	const peers = groupSetsIndexes(sources);

	return Object.fromEntries(
		sources.map(({ catalogueId, loaded, resolution }) => [
			catalogueId,
			{ loaded, peers: peers[catalogueId] ?? [], resolution },
		]),
	);
};
