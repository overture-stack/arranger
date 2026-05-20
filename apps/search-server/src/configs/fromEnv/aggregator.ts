import { merge } from 'lodash-es';

import type { AllServerConfigs, ExternalConfigs } from '#configs/types/index.js';

import configsFromLocalEnv from './localEnvs.js';

const configsAggregator = (
	externalConfigs: ExternalConfigs = {},
): AllServerConfigs & { catalogConfigsPath: string } => {
	const {
		allowedCorsOrigins,
		catalogConfigsPath,
		disableDownloads,
		disableFilters,
		disablePlayground,
		disableSets,
		enableAdmin,
		enableDebug,
		enableLogs,
		filters,
		pingMs,
		pingPath,
		serverPort,
		setsIndex,
		setsType,
	} = externalConfigs;

	const aggregatedEnvConfigs = merge({}, configsFromLocalEnv, {
		allowedCorsOrigins,
		catalogConfigsPath,
		catalogs: {
			fromEnv: {
				disableDownloads,
				disableFilters,
				disablePlayground,
				disableSets,
				enableAdmin,
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
