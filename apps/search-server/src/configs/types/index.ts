import { type ArrangerBaseContext, type SearchClient } from '@overture-stack/arranger-graphql-router';
import {
	type configRootProperties,
	type AllFeatureFlagConfigs,
	type ConfigsObject as ArrangerConfigs,
	type GetServerSideFilterFn,
	type NetworkConfig,
	type RuntimeFeatureFlagConfigs,
	type SearchEngineType,
} from '@overture-stack/arranger-types/configs';

import { serverNetworkConfigExtendedProperties, type serverConfigProperties } from './constants.js';

export type CatalogsMap = Record<string, Partial<ArrangerConfigs<any>>>;

export type HealthConfigs = {
	[serverConfigProperties.PING_MS]: number;
	[serverConfigProperties.PING_PATH]: string;
};

export type BaseServerConfigs = {
	[serverConfigProperties.ALLOWED_CORS_ORIGINS]?: string[];
	[serverConfigProperties.SERVER_PORT]: number;
} & RuntimeFeatureFlagConfigs;

export type ExternalNetworkConfig = Partial<{
	[serverNetworkConfigExtendedProperties.PASSTHROUGH_HEADERS]: string[];
}> &
	NetworkConfig<ArrangerBaseContext>;

export type ExternalConfigs = Partial<
	{
		[serverConfigProperties.CONFIGS_PATH]: string;
		currentDirectory: string;
		esClient: SearchClient;
		filters: GetServerSideFilterFn<any>;
		searchEngine: SearchEngineType;
		setsIndex: string;
		setsType: string;
		[configRootProperties.NETWORK_AGGREGATION]: ExternalNetworkConfig;
	} & BaseServerConfigs &
		AllFeatureFlagConfigs &
		HealthConfigs
>;

export type AllServerConfigs = {
	catalogs: CatalogsMap;
	health: HealthConfigs;
} & BaseServerConfigs;
