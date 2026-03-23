import type { Client } from '@elastic/elasticsearch';
import type {
	AllFeatureFlagConfigs,
	ConfigsObject as ArrangerConfigs,
	GetServerSideFilterFn,
	RuntimeFeatureFlagConfigs,
} from '@overture-stack/arranger-types/configs';

import type { serverConfigProperties } from './constants.js';

export type CatalogsMap = Record<string, Partial<ArrangerConfigs>>;

export type HealthConfigs = {
	[serverConfigProperties.PING_MS]: number;
	[serverConfigProperties.PING_PATH]: string;
};

export type BaseServerConfigs = {
	[serverConfigProperties.ALLOWED_CORS_ORIGINS]?: string[];
	[serverConfigProperties.SERVER_PORT]: number;
} & RuntimeFeatureFlagConfigs;

export type ExternalConfigs = Partial<
	{
		[serverConfigProperties.CONFIGS_PATH]: string;
		currentDirectory: string;
		esClient: Client;
		filters: GetServerSideFilterFn;
		setsIndex: string;
		setsType: string;
	} & BaseServerConfigs &
		AllFeatureFlagConfigs &
		HealthConfigs
>;

export type AllServerConfigs = {
	catalogs: CatalogsMap;
	health: HealthConfigs;
} & BaseServerConfigs;
