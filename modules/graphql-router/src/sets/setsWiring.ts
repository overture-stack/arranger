import type { SearchClient } from '#searchClient/types.js';

import { resolveSetsIndex, type SetsIndexConfigs, type SetsIndexResolution } from './resolveSetsIndex.js';
import type { SetsIndexPeer } from './setsIndexGroups.js';
import type { SetsScope } from './setsAccess.js';

/**
 * A catalogue's saved-sets wiring: how its index resolved, and the scope its sets are held to. Both are undefined
 * where saved sets are not enabled.
 */
export type SetsWiring = Readonly<{ resolution?: SetsIndexResolution; scope?: SetsScope }>;

/** Resolves a sets index with the search client, which must be given where nothing resolved it already. */
const resolveWith = ({
	esClient,
	...details
}: Omit<Parameters<typeof resolveSetsIndex>[0], 'esClient'> & { esClient: SearchClient | undefined }) => {
	if (!esClient) {
		throw new Error('Saved sets are enabled, but no search client was given to resolve the sets index with.');
	}

	return resolveSetsIndex({ ...details, esClient });
};

/**
 * Settles a catalogue's saved-sets wiring. A resolution and its peers given by the host are used as they are; without
 * them, the index is resolved here, with no peer information. Nothing is wired while saved sets are not enabled.
 *
 * @param details the catalogue's id and configs, the search client, the label identifying it in logs, whether saved
 *   sets have owners and are enabled, and what the host already resolved for it.
 */
export const setsWiringFor = async ({
	catalogueId,
	configs,
	enableSets,
	esClient,
	label,
	owned,
	setsIndexPeers,
	setsIndexResolution,
}: {
	catalogueId?: string;
	configs: SetsIndexConfigs & { documentType?: string };
	enableSets: boolean;
	esClient: SearchClient | undefined;
	label: string;
	owned: boolean;
	setsIndexPeers?: readonly SetsIndexPeer[];
	setsIndexResolution?: SetsIndexResolution;
}): Promise<SetsWiring> => {
	if (!enableSets) {
		return {};
	}

	const resolution = setsIndexResolution ?? (await resolveWith({ catalogueId, configs, esClient, label, owned }));
	const recordedCatalogue = catalogueId ?? label;

	return {
		resolution,
		scope: {
			catalogue: recordedCatalogue,
			documentType: configs.documentType,
			ownIndex: resolution.kind === 'index' && resolution.origin === 'default',
			peerDocumentTypes: setsIndexPeers?.flatMap(({ documentType }) => (documentType ? [documentType] : [])),
		},
	};
};
