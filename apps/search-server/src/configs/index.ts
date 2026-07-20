import fs from 'fs';
import path from 'path';

import { resolveCatalogId } from './catalogId.js';
import aggregateConfigsFromEnv from './fromEnv/index.js';
import getConfigFromFiles from './fromFiles/fileHandlers.js';
import type { AllServerConfigs, CatalogsMap } from './types/index.js';

const buildCataloguesFromFolder = async ({
	catalogueConfigsPath,
	configsFromEnv: { catalogs, enableDebug },
	currentDirectory,
}: {
	catalogueConfigsPath: string;
	configsFromEnv: AllServerConfigs;
	currentDirectory: string;
}): Promise<CatalogsMap> => {
	const usedIds = new Set<string>();
	const resolvedBase = path.resolve(currentDirectory, catalogueConfigsPath);
	const entries = await fs.promises.readdir(resolvedBase, { withFileTypes: true });
	const hasJsonFiles = (entries: fs.Dirent[]) => entries.some((e) => e.isFile() && e.name.endsWith('.json'));
	const getSubdirectories = (entries: fs.Dirent[]) => entries.filter((e) => e.isDirectory());

	if (hasJsonFiles(entries)) {
		const [configsPath, aggregatedConfigs] = await getConfigFromFiles({
			// FIXME: TypeScript doesn't believe this won't be undefined.
			baseConfig: catalogs.fromEnv || {},
			catalogueConfigsPath,
			enableDebug,
			currentDirectory,
		});

		const catalogId = resolveCatalogId({
			aggregatedConfigs,
			configsPath,
			usedIds,
		});
		console.log(`    Registered catalogue "${catalogId}"`);

		return {
			[catalogId]: aggregatedConfigs,
		};
	}

	const subdirectories = getSubdirectories(entries);
	const cataloguesMap: CatalogsMap = {};

	if (subdirectories.length === 0) {
		console.log('No JSON files or subdirectories found. Using env defaults.');
		return {};
	}

	console.log(`  - Found ${subdirectories.length} catalogue directories in '${catalogueConfigsPath}'`);

	for (const dir of subdirectories) {
		const subPath = path.join(catalogueConfigsPath, dir.name);
		console.log(`  - Loading catalogue from '${subPath}'...`);

		try {
			const [configsPath, aggregatedConfigs] = await getConfigFromFiles({
				// FIXME: TypeScript doesn't believe this won't be undefined.
				baseConfig: catalogs.fromEnv || {}, // FIXME why is this necessary?
				catalogueConfigsPath: subPath,
				enableDebug,
				currentDirectory,
			});

			const catalogId = resolveCatalogId({
				aggregatedConfigs,
				configsPath,
				usedIds,
			});

			cataloguesMap[catalogId] = aggregatedConfigs;
			console.log(`    Registered catalogue "${catalogId}"`);
		} catch (err) {
			console.log(`  Error loading catalogue from ${dir.name}:`, (err as Error).message);
		}
	}

	if (Object.keys(cataloguesMap).length === 0) {
		console.log('No catalogues loaded from subdirectories. Preserving env defaults.');
		const catalogId = resolveCatalogId({
			aggregatedConfigs: catalogs.fromEnv || {},
			configsPath: resolvedBase,
			usedIds,
		});

		return {
			[catalogId]: catalogs.fromEnv || {},
		};
	}

	return cataloguesMap;
};

const loadAllConfigs = async ({ currentDirectory = '', ...externalConfigs }): Promise<AllServerConfigs> => {
	console.log('Gathering configuration data:');

	// TODO: validate external configs to prevent undesired items, warn deprecations, etc.
	const { catalogueConfigsPath, ...configsFromEnv } = aggregateConfigsFromEnv(externalConfigs);

	try {
		// TODO: this function should do all the multicatalogue config parsing
		const catalogueConfigs = await buildCataloguesFromFolder({
			catalogueConfigsPath,
			configsFromEnv,
			currentDirectory,
		});

		const aggregatedConfigs = {
			...configsFromEnv,
			catalogs: catalogueConfigs,
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

export default loadAllConfigs;
