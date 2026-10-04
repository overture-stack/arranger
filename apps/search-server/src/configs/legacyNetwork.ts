import { merge } from 'lodash-es';

import { ENV_MIGRATION_URL } from '#configs/fromEnv/renamedEnvs.js';

/** How a 3.0 deployment's environment configured network search, read as 3.0 read it. */
export type LegacyNetworkEnv = {
	/** ENABLE_NETWORK_AGGREGATION, true only for the text `true`, in any case. */
	enabled: boolean;
	/** NETWORK_AGGREGATIONS, the JSON list of remote nodes, or none where it held no list. */
	list: unknown[];
};

/** A deprecation warning about network search's 3.0 configuration, printed once at startup. */
export type NetworkNotice = {
	code: 'ARRANGER_NETWORK_CONFIG';
	message: string;
};

const noticeOf = (message: string): NetworkNotice => ({
	code: 'ARRANGER_NETWORK_CONFIG',
	message: `${message} See ${ENV_MIGRATION_URL}#network-config-shape`,
});

/** Whether a variable holds a value: a blank one counts as unset, as 3.0 read it. */
const isSet = (value: string | undefined): value is string => value !== undefined && value.trim() !== '';

// 3.0 parsed the list as JSON, and read anything that is not a JSON list as no remote nodes.
const listFromVersion3 = (value: string): unknown[] => {
	try {
		const parsed: unknown = JSON.parse(value);

		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
};

/**
 * Reads ENABLE_NETWORK_AGGREGATION and NETWORK_AGGREGATIONS, which 3.0 configured network search with,
 * as 3.0 read them, for {@link resolveLegacyNetwork} to apply to each catalogue. A notice names a
 * variable and never repeats its value.
 *
 * @param env the environment as the process received it.
 * @returns the 3.0 network settings, and a notice for each of the two variables that is set.
 */
export const readLegacyNetworkEnv = (
	env: NodeJS.ProcessEnv,
): { legacy: LegacyNetworkEnv; notices: NetworkNotice[] } => {
	const flag = env.ENABLE_NETWORK_AGGREGATION;
	const listText = env.NETWORK_AGGREGATIONS;
	const enabled = isSet(flag) && flag.toLowerCase() === 'true';
	const list = isSet(listText) ? listFromVersion3(listText) : [];

	const flagNotices = isSet(flag)
		? [
				noticeOf(
					enabled
						? 'ENABLE_NETWORK_AGGREGATION is deprecated: network search is on for each catalogue whose network configuration lists remote nodes under "remoteNodes", so list them there, then remove ENABLE_NETWORK_AGGREGATION.'
						: 'ENABLE_NETWORK_AGGREGATION has no effect, as in 3.0, which read its value as the default: remove it.',
				),
			]
		: [];

	const listNotices = isSet(listText)
		? [
				noticeOf(
					list.length === 0
						? 'NETWORK_AGGREGATIONS has no effect, as in 3.0, which read its value as no remote nodes: remove it.'
						: enabled
							? 'NETWORK_AGGREGATIONS is deprecated: list its remote nodes under "remoteNodes" in each catalogue\'s network configuration instead.'
							: 'NETWORK_AGGREGATIONS has no effect, as in 3.0, since ENABLE_NETWORK_AGGREGATION is not true: remove it, or list its remote nodes under "remoteNodes" in a catalogue\'s network configuration to turn network search on.',
				),
			]
		: [];

	return { legacy: { enabled, list }, notices: [...flagNotices, ...listNotices] };
};

/**
 * Reads a catalogue's network configuration in the 3.0 shape, a list of remote nodes, as the 3.1 shape
 * that lists them under `remoteNodes`, so a 3.0 deployment keeps the network search it had. As in 3.0,
 * the list is NETWORK_AGGREGATIONS's with the configuration files' laid over it index by index, and
 * network search is on only where ENABLE_NETWORK_AGGREGATION is true. A list holding no node is dropped
 * rather than read as a network of none. A 3.1 network configuration is kept as it is.
 *
 * @param args.catalogue the catalogue's configuration, its files laid over the environment's.
 * @param args.catalogueId the catalogue's ID, which a notice names.
 * @param args.legacy the 3.0 network settings from the environment, from {@link readLegacyNetworkEnv}.
 * @returns the catalogue's configuration to use, and a notice wherever its files set a 3.0 list, set a
 * 3.1 configuration that NETWORK_AGGREGATIONS would otherwise have applied to, or, with the flag on, list
 * no node, where 3.0 refused to start.
 */
export const resolveLegacyNetwork = <Catalogue extends { network?: unknown }>({
	catalogue,
	catalogueId,
	legacy,
}: {
	catalogue: Catalogue;
	catalogueId: string;
	legacy: LegacyNetworkEnv;
}): { catalogue: Catalogue; notices: NetworkNotice[] } => {
	const { network, ...rest } = catalogue;
	const environmentApplies = legacy.enabled && legacy.list.length > 0;

	if (network !== undefined && !Array.isArray(network)) {
		return {
			catalogue,
			notices: environmentApplies
				? [
						noticeOf(
							`Catalogue "${catalogueId}" lists its remote nodes under "remoteNodes", so NETWORK_AGGREGATIONS is not read for it.`,
						),
					]
				: [],
		};
	}

	const fileList: unknown[] = network ?? [];
	const list: unknown[] = merge([], legacy.list, fileList);

	const notices =
		fileList.length > 0
			? [
					noticeOf(
						legacy.enabled
							? `Catalogue "${catalogueId}" lists its remote nodes in the 3.0 shape, which is deprecated: list them under "remoteNodes" instead.`
							: `Catalogue "${catalogueId}" lists remote nodes in the 3.0 shape, which has no effect, as in 3.0, since ENABLE_NETWORK_AGGREGATION is not true: remove the list, or list the nodes under "remoteNodes" to turn network search on.`,
					),
				]
			: [];

	if (legacy.enabled && list.length > 0) {
		// Configuration files are read unvalidated, as normalize.ts reads them, so the nodes are taken to be what the type says.
		return { catalogue: { ...rest, network: { remoteNodes: list } } as unknown as Catalogue, notices };
	}

	// 3.0 refused to start here, so the catalogue served without network search is named rather than left silent.
	const unlistedNotices = legacy.enabled
		? [
				noticeOf(
					`ENABLE_NETWORK_AGGREGATION is true, but catalogue "${catalogueId}" lists no remote node, so it is served without network search.`,
				),
			]
		: [];

	return {
		catalogue: network === undefined ? catalogue : (rest as Catalogue),
		notices: [...notices, ...unlistedNotices],
	};
};
