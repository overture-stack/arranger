import { resolveCatalogId } from './catalogId.js';
import aggregateConfigsFromEnv from './fromEnv/index.js';
import getConfigFromFiles from './fromFiles/fileHandlers.js';
import type { AllServerConfigs, CatalogsMap } from './types/index.js';

// TODO: needs logic to support multiple catalogs
// check if there's JSONs in this folder, then and do this following logic as is...
// otherwise, if it finds folders, then read the jsons
// therein as configs for one Arranger per folder.

const buildCatalogsFromFolder = async ({
	catalogConfigsPath,
	configsFromEnv: { catalogs, enableDebug },
	currentDirectory,
}: {
	catalogConfigsPath: string;
	configsFromEnv: AllServerConfigs;
	currentDirectory: string;
}): Promise<CatalogsMap> => {
	const usedIds = new Set<string>();

	const [configsPath, aggregatedConfigs] = await getConfigFromFiles({
		// FIXME: TypeScript doesn't believe this won't be undefined.
		baseConfig: catalogs.fromEnv || {}, // WHY!?
		catalogConfigsPath,
		enableDebug,
		currentDirectory,
	});

	const catalogId = resolveCatalogId({
		aggregatedConfigs,
		configsPath,
		usedIds,
	});

	return {
		[catalogId]: aggregatedConfigs,
	};
};

const loadAllsConfigs = async ({ currentDirectory = '', ...externalConfigs }): Promise<AllServerConfigs> => {
	console.log('Gathering configuration data:');

	// TODO: validate external configs to prevent undesired items, warn deprecations, etc.
	const { catalogConfigsPath, ...configsFromEnv } = aggregateConfigsFromEnv(externalConfigs);

	try {
		// TODO: this function should do all the multicatalog config parsing
		const catalogConfigs = await buildCatalogsFromFolder({
			catalogConfigsPath,
			configsFromEnv,
			currentDirectory,
		});

		const aggregatedConfigs = {
			...configsFromEnv,
			catalogs: catalogConfigs,
		};

		// TODO: some form of config validation and logging for it
		// aggregatedConfigs.enableDebug &&
		// 	console.log('\n\nDebugging aggregatedConfigs in configs/index:', aggregatedConfigs, '\n');

		return aggregatedConfigs;
	} catch (err) {
		configsFromEnv.enableDebug && err && console.log(`\n  DEBUG: ${err}\n`);
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
