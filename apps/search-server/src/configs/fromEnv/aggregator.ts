import { merge } from 'lodash-es';

import type { LegacyNetworkEnv } from '#configs/legacyNetwork.js';
import type { AllServerConfigs, ExternalConfigs } from '#configs/types/index.js';

import { resolveImageAccessControl } from './enableAccessControl.js';
import configsFromLocalEnv from './localEnvs.js';

/**
 * Overlays the host's programmatic options on the environment's configuration, refusing startup before
 * any catalogue loads when ENABLE_ACCESS_ENFORCEMENT cannot be honoured.
 *
 * @param externalConfigs the host's programmatic options.
 * @throws {Error} when ENABLE_ACCESS_CONTROL is set, when ENABLE_ACCESS_ENFORCEMENT is unrecognized, or when it is
 *   true beside a filters or getRequester option.
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
		getRequester,
		pingMs,
		pingPath,
		readyPath,
		serverPort,
		setsIndex,
		setsType,
	} = externalConfigs;

	const { enableAccessControl, ...envConfigs } = configsFromLocalEnv;
	const { enforcement, filterSource, getServerSideFilter } = resolveImageAccessControl({
		enableAccessControl,
		filters,
		getRequester,
	});

	console.log('access_enforcement.switch', `access enforcement: ${enforcement}`);
	console.log('server_side_filter.image_source', `server-side filter source: ${filterSource}`);

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
				...(getRequester && { getRequester }),
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
		usherAccessControl: enableAccessControl.setting === 'enabled',
	});

	return aggregatedEnvConfigs;
};

export default configsAggregator;
