import { merge } from 'lodash-es';

import type { LegacyNetworkEnv } from '#configs/legacyNetwork.js';
import type { AllServerConfigs, ExternalConfigs } from '#configs/types/index.js';

import { resolveImageAccessControl } from './enableAccessControl.js';
import configsFromLocalEnv from './localEnvs.js';

/**
 * Overlays the host's programmatic options on the environment's configuration, refusing startup before
 * any catalogue loads when ENABLE_ACCESS_CONTROL cannot be honoured.
 *
 * @param externalConfigs the host's programmatic options.
 * @throws {Error} when ENABLE_ACCESS_CONTROL is true or unrecognized, or false alongside a filters option.
 */
const configsAggregator = (
	externalConfigs: ExternalConfigs = {},
): AllServerConfigs & { catalogueConfigsPath: string; legacyNetwork: LegacyNetworkEnv } => {
	const {
		allowedCorsOrigins,
		catalogueConfigsPath,
		disableDownloads,
		disableFilters,
		disableGraphQLIntrospection,
		disablePlayground,
		enableAdmin,
		enableDebug,
		enableGraphQLBatching,
		enableLogs,
		enableSets,
		filters,
		pingMs,
		pingPath,
		readyPath,
		serverPort,
		setsIndex,
		setsType,
	} = externalConfigs;

	const { enableAccessControl, ...envConfigs } = configsFromLocalEnv;
	const { getServerSideFilter, source } = resolveImageAccessControl({ enableAccessControl, filters });

	console.log('access_control.image_source', `access control source: ${source}`);

	// lodash merge skips missing externalConfigs values, falling back to the localEnvs default.
	// and first empty {} prevents mutating the configsFromLocalEnv module singleton.
	const aggregatedEnvConfigs = merge({}, envConfigs, {
		allowedCorsOrigins,
		catalogueConfigsPath,
		catalogs: {
			fromEnv: {
				disableDownloads,
				disableFilters,
				disableGraphQLIntrospection,
				disablePlayground,
				enableAdmin,
				enableGraphQLBatching,
				enableSets,
				getServerSideFilter,
				sets: {
					index: setsIndex,
					type: setsType,
				},
			},
		},
		enableDebug,
		enableLogs,
		health: {
			pingMs,
			pingPath,
			readyPath,
		},
		serverPort,
	});

	return aggregatedEnvConfigs;
};

export default configsAggregator;
