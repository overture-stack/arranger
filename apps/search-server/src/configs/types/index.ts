import { type SearchClient } from '@overture-stack/arranger-graphql-router';
import type {
	AllFeatureFlagConfigs,
	ConfigsObject as ArrangerConfigs,
	GetServerSideFilterFn,
	RuntimeFeatureFlagConfigs,
	SearchEngineType,
} from '@overture-stack/arranger-types/configs';

import type { serverConfigProperties } from './constants.js';

export type CatalogsMap = Record<string, Partial<ArrangerConfigs<any>>>;

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
		esClient: SearchClient;
		filters: GetServerSideFilterFn<any>;
		searchEngine: SearchEngineType;
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
