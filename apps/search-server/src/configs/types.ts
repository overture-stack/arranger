import { type ObjectEncodingOptions } from 'fs';
import { type Abortable } from 'node:events';

import type { ConfigsObject as ArrangerConfigs } from '@overture-stack/arranger-types/configs';

import type configsFromEnv from './configsFromEnv.js';

export type ConfigsFromEnv = typeof configsFromEnv;

export type CatalogsMap = Record<string, Partial<ArrangerConfigs>>;

export type AllServerConfigs = {
	configsSource: string;
	enableDebug: boolean;
	enableLogs: boolean;
	enableNetworkAggregation: boolean;
	pingMs: number;
	pingPath: string;
	port: number;
	catalogs: CatalogsMap;

	// FIXME: Needs work, obviously
	// [arrangerConfigProperties.NETWORK_AGGREGATION]: string;
};

export type FileEncodingType =
	| BufferEncoding
	| (ObjectEncodingOptions & { flag?: string | undefined } & Abortable)
	| null
	| undefined;

export type ConfigsFromFiles = (args: {
	baseConfig: Partial<ArrangerConfigs>;
	configsSource: string;
	rootPath: string;
}) => Promise<Partial<ArrangerConfigs>>;
