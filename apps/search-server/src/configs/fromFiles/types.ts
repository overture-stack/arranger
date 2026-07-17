import { type ObjectEncodingOptions } from 'fs';
import { type Abortable } from 'node:events';

import type { ConfigsObject as ArrangerConfigs } from '@overture-stack/arranger-types/configs';

export type FileEncodingType =
	| BufferEncoding
	| (ObjectEncodingOptions & { flag?: string | undefined } & Abortable)
	| null
	| undefined;

export type ConfigsFromFilesFn = (args: {
	baseConfig: Partial<ArrangerConfigs<any>>;
	catalogueConfigsPath: string;
	currentDirectory: string;
	enableDebug: boolean;
}) => Promise<
	[
		string, // configsPath
		Partial<ArrangerConfigs<any>>, // configFromFiles
	]
>;
