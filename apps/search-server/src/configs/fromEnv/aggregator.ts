import { merge } from 'lodash-es';

import type { AllServerConfigs, ExternalConfigs } from '#configs/types/index.js';

import configsFromLocalEnv from './localEnvs.js';

const configsAggregator = (
	externalConfigs: ExternalConfigs = {},
): AllServerConfigs & { catalogueConfigsPath: string } => {
	const {
		allowedCorsOrigins,
		catalogueConfigsPath,
		disableDownloads,
		disableFilters,
		disablePlayground,
		enableAdmin,
		enableDebug,
		enableLogs,
		enableSets,
		filters,
		pingMs,
		pingPath,
		serverPort,
		setsIndex,
		setsType,
	} = externalConfigs;

	const aggregatedEnvConfigs = merge({}, configsFromLocalEnv, {
		allowedCorsOrigins,
		catalogueConfigsPath,
		catalogs: {
			fromEnv: {
				disableDownloads,
				disableFilters,
				disablePlayground,
				enableAdmin,
				enableSets,
				getServerSideFilter: filters,
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
		},
		serverPort,
	});

	return aggregatedEnvConfigs;
};

export default configsAggregator;
