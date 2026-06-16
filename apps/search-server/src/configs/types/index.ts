import { type ArrangerBaseContext, type SearchClient } from '@overture-stack/arranger-graphql-router';
import {
	type configArrangerNetworkProperties,
	type AllFeatureFlagConfigs,
	type ConfigsObject as ArrangerConfigs,
	type configRootProperties,
	type GetServerSideFilterFn,
	type NetworkConfig,
	type RemoteNodeConfig,
	type RuntimeFeatureFlagConfigs,
	type SearchEngineType,
} from '@overture-stack/arranger-types/configs';

import {
	type serverNetworkConfigExtendedProperties,
	type serverNetworkRemoteRequestCustomizationConfigProperties,
	type serverConfigProperties,
} from './constants.js';

export type CatalogsMap = Record<string, Partial<ArrangerConfigs<any>>>;

export type HealthConfigs = {
	[serverConfigProperties.PING_MS]: number;
	[serverConfigProperties.PING_PATH]: string;
};

export type BaseServerConfigs = {
	[serverConfigProperties.ALLOWED_CORS_ORIGINS]?: string[];
	[serverConfigProperties.SERVER_PORT]: number;
} & RuntimeFeatureFlagConfigs;

/**
 * Properties to customzie remote requests by adding additional properties:
 * - headers: pass headers from in the incoming query to requests to the remote node
 */
export type ExternalNetworkRequestsCustomizationConfig = Partial<{
	[serverNetworkRemoteRequestCustomizationConfigProperties.HEADERS]: string[];
}>;

/**
 * Extend the Remote Node Config to allow config files to specify customizations for individual nodes:
 * - requests: Remote request customization properties. properties included here will overwrite the properties
 *             set at the network config level for this individual node. Leave properties undefined to use the
 *             shared network config.
 *
 */
export type ExternalRemoteNodeConfig = Partial<{
	requests: ExternalNetworkRequestsCustomizationConfig;
}> &
	RemoteNodeConfig;

/**
 * Extend the NetworkConfig to allow config files to specify additional properties:
 * - remoteRequests: customize all remote requests. applies to all remote nodes.
 * - remoteNodes: uses the ExtendedRemoteNodeConfig which has additional properties for customizing individual nodes
 */
export type ExternalNetworkConfig = Partial<{
	[serverNetworkConfigExtendedProperties.REMOTE_REQUESTS]?: ExternalNetworkRequestsCustomizationConfig;
	[configArrangerNetworkProperties.REMOTE_NODES]: ExternalRemoteNodeConfig[];
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
