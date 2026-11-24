import type { SetsConfigs } from '@overture-stack/arranger-types/configs';
import { setsProperties } from '@overture-stack/arranger-types/configs/constants';

import type { SearchClient } from '#searchClient/types.js';
import { MIGRATION_GUIDE_URL } from '#utils/migrationGuide.js';

/** Where a catalogue's sets index came from: its own configuration, a legacy shared index, or the default name. */
export type SetsIndexOrigin = 'configured' | 'legacy-shared' | 'default';

/**
 * Why a catalogue has no sets index: its legacy shared index is named but absent; the engine refused a check of it; or,
 * under `getRequester`, the router has no catalogue id to scope sets by.
 */
export type SetsIndexUnavailableReason = 'legacy_index_missing' | 'index_check_refused' | 'missing_catalogue_id';

/** A catalogue's resolved sets index, or the reason it has none. */
export type SetsIndexResolution =
	| Readonly<{ index: string; kind: 'index'; origin: SetsIndexOrigin }>
	| Readonly<{ index?: string; kind: 'unavailable'; reason: SetsIndexUnavailableReason }>;

/** The sets configuration a catalogue resolves its index from, as the router validates it. */
export type SetsIndexConfigs = { sets?: SetsConfigs };

const SETS_INDEX_PER_CATALOGUE_URL = `${MIGRATION_GUIDE_URL}#sets-index-per-catalogue`;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/**
 * Whether an index exists, from the engine's answer to a check. Any answer other than found or not found is a refusal.
 *
 * @throws whatever the engine rejects the check with, or an answer that is neither found nor not found.
 */
const indexExists = async (esClient: SearchClient, index: string): Promise<boolean> => {
	const answer: unknown = await esClient.indices.exists({ index });
	const statusCode = isRecord(answer) ? answer.statusCode : undefined;

	if (statusCode === 200) {
		return true;
	}

	if (statusCode === 404) {
		return false;
	}

	throw new Error(`The engine answered the existence check of "${index}" with ${String(statusCode)}.`);
};

/**
 * Resolves the sets index a catalogue uses, in this order:
 *
 * 1. the catalogue's own `sets.index`, which init creates when missing;
 * 2. the legacy shared index the server names in `sets.legacySharedIndex`, used only where it exists, and never created;
 * 3. `arranger-sets-<catalogue id>`.
 *
 * Under `getRequester` a catalogue id is required, since a set is scoped to the catalogue it was saved from. Without
 * it, the label stands in as the id, so the default name and the recorded catalogue are the label.
 *
 * Nothing here creates an index, and a check the engine refuses ends in `unavailable`, never a silent default.
 *
 * @param details the catalogue's id if it has one, its validated configs, the search client, the label identifying it
 *   in logs, and whether saved sets have owners.
 */
export const resolveSetsIndex = async ({
	catalogueId,
	configs,
	esClient,
	label,
	owned,
}: {
	catalogueId?: string;
	configs: SetsIndexConfigs;
	esClient: SearchClient;
	label: string;
	owned: boolean;
}): Promise<SetsIndexResolution> => {
	const catalogue = catalogueId ?? label;
	const configuredIndex = configs.sets?.[setsProperties.INDEX];
	const legacySharedIndex = configs.sets?.[setsProperties.LEGACY_SHARED_INDEX];

	if (owned && !catalogueId) {
		return { kind: 'unavailable', reason: 'missing_catalogue_id' };
	}

	if (configuredIndex) {
		return { index: configuredIndex, kind: 'index', origin: 'configured' };
	}

	if (legacySharedIndex) {
		const existence = await indexExists(esClient, legacySharedIndex).then(
			(exists) => ({ exists }),
			() => undefined,
		);

		if (existence === undefined) {
			return { index: legacySharedIndex, kind: 'unavailable', reason: 'index_check_refused' };
		}

		if (!existence.exists) {
			return { index: legacySharedIndex, kind: 'unavailable', reason: 'legacy_index_missing' };
		}

		console.warn(
			'sets.index_legacy_shared',
			`Saved sets of "${catalogue}" are read from the shared sets index "${legacySharedIndex}", which is deprecated. Give each catalogue its own sets index as ${SETS_INDEX_PER_CATALOGUE_URL} describes.`,
			{ catalogue, index: legacySharedIndex },
		);

		return { index: legacySharedIndex, kind: 'index', origin: 'legacy-shared' };
	}

	return { index: `arranger-sets-${catalogue}`, kind: 'index', origin: 'default' };
};
