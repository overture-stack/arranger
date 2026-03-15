import path from 'path';

import { resolveCatalogId } from './catalogId.js';
import configsFromEnv from './configsFromEnv.js';
import getConfigFromFiles from './getConfigFromFiles.js';
import type { AllServerConfigs, CatalogsMap } from './types.js';

// TODO: MultiCatalog logic
// check if there's JSONs in this folder, then and do this following logic as is...
// otherwise, if it finds folders, then read the jsons
// therein as configs for one Arranger per folder.

const buildCatalogsFromFolder = async ({
	configsSource,
	rootPath,
}: {
	configsSource: string;
	rootPath: string;
}): Promise<CatalogsMap> => {
	const configsPath = path.resolve(rootPath, configsSource);
	const usedIds = new Set<string>();

	const config = await getConfigFromFiles({
		baseConfig: configsFromEnv.catalogs.fromEnv,
		configsSource,
		rootPath,
	});
	const folderName = path.basename(configsPath);
	const catalogId = resolveCatalogId({
		config,
		folderName,
		usedIds,
		seed: configsPath,
	});

	return {
		[catalogId]: config,
	};
};

const loadAllsConfigs = async ({ rootPath = '' }): Promise<AllServerConfigs> => {
	console.log('Gathering configuration data:');
	try {
		const catalogs = await buildCatalogsFromFolder({
			configsSource: configsFromEnv.configsSource,
			rootPath,
		});

		const aggregatedConfigs: AllServerConfigs = {
			...configsFromEnv,
			catalogs,
		};

		// TODO: some form of config validation and logging for it
		// aggregatedConfigs.enableDebug &&
		// 	console.log('\n\nDebugging aggregatedConfigs in configs/index:', aggregatedConfigs, '\n');

		return aggregatedConfigs;
	} catch (error) {
		console.log('  - Defaulting to config values from the environment...');
		return configsFromEnv;

		// return (
		// 	validateProperties(configsFromEnv) ||
		// 	// this is unreachable right now, but it's left here to cover edge cases from future implementation
		// 	console.error(error || Error('Something went wrong while creating the configuration object.'))
		// );
	}
};

export default loadAllsConfigs;
export { configsFromEnv };
