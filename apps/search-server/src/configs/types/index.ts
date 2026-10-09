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
import type { BridgeCore, BridgeLogger } from '@overture-stack/usher-express-bridge';

import {
	type serverNetworkConfigExtendedProperties,
	type serverNetworkRemoteRequestCustomizationConfigProperties,
	type serverConfigProperties,
} from './constants.js';

export type CataloguesMap = Record<string, Partial<ArrangerConfigs<ArrangerBaseContext>>>;

export type HealthConfigs = {
	[serverConfigProperties.PING_MS]: number;
	[serverConfigProperties.PING_PATH]: string;
	[serverConfigProperties.READY_PATH]: string;
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

/**
 * The Usher bridge a host hands the image, with the logger it writes to, in place of one built from the
 * environment. Read only while ENABLE_ACCESS_CONTROL is true.
 */
export type UsherSeam = Readonly<{ bridge: BridgeCore; logger: BridgeLogger }>;

/** Each catalogue's registration with Usher's bridge, as its `usher.json` holds it, by catalogue id. */
export type UsherRegistrations = Record<string, unknown>;

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
		usher: UsherSeam;
	} & BaseServerConfigs &
		AllFeatureFlagConfigs &
		HealthConfigs
>;

export type AllServerConfigs = {
	catalogs: CataloguesMap;
	health: HealthConfigs;
	/** Whether ENABLE_ACCESS_CONTROL asks for the Usher adapter. */
	usherAccessControl: boolean;
	/** Each catalogue's `usher.json`, for those holding one. */
	usherRegistrations?: UsherRegistrations;
} & BaseServerConfigs;
