import fs from 'fs';
import path from 'path';

import { resolveCatalogId } from './catalogId.js';
import aggregateConfigsFromEnv from './fromEnv/index.js';
import getConfigFromFiles from './fromFiles/fileHandlers.js';
import type { AllServerConfigs, CatalogsMap } from './types/index.js';

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
	const resolvedBase = path.resolve(currentDirectory, catalogConfigsPath);
	const entries = await fs.promises.readdir(resolvedBase, { withFileTypes: true });
	const hasJsonFiles = (entries: fs.Dirent[]) => entries.some((e) => e.isFile() && e.name.endsWith('.json'));
	const getSubdirectories = (entries: fs.Dirent[]) => entries.filter((e) => e.isDirectory());

	if (hasJsonFiles(entries)) {
		const [configsPath, aggregatedConfigs] = await getConfigFromFiles({
			// FIXME: TypeScript doesn't believe this won't be undefined.
			baseConfig: catalogs.fromEnv || {},
			catalogConfigsPath,
			enableDebug,
			currentDirectory,
		});

		const catalogId = resolveCatalogId({
			aggregatedConfigs,
			configsPath,
			usedIds,
		});
		console.log(`    Registered catalog "${catalogId}"`);

		return {
			[catalogId]: aggregatedConfigs,
		};
	}

	const subdirectories = getSubdirectories(entries);
	const catalogsMap: CatalogsMap = {};

	if (subdirectories.length === 0) {
		console.log('No JSON files or subdirectories found. Using env defaults.');
		return {};
	}

	console.log(`  - Found ${subdirectories.length} catalog directories in '${catalogConfigsPath}'`);

	for (const dir of subdirectories) {
		const subPath = path.join(catalogConfigsPath, dir.name);
		console.log(`  - Loading catalog from '${subPath}'...`);

		try {
			const [configsPath, aggregatedConfigs] = await getConfigFromFiles({
				// FIXME: TypeScript doesn't believe this won't be undefined.
				baseConfig: catalogs.fromEnv || {}, // FIXME why is this necessary?
				catalogConfigsPath: subPath,
				enableDebug,
				currentDirectory,
			});

			const catalogId = resolveCatalogId({
				aggregatedConfigs,
				configsPath,
				usedIds,
			});

			catalogsMap[catalogId] = aggregatedConfigs;
			console.log(`    Registered catalog "${catalogId}"`);
		} catch (err) {
			console.log(`  Error loading catalog from ${dir.name}:`, (err as Error).message);
		}
	}

	if (Object.keys(catalogsMap).length === 0) {
		console.log('No catalogs loaded from subdirectories. Preserving env defaults.');
		const catalogId = resolveCatalogId({
			aggregatedConfigs: catalogs.fromEnv || {},
			configsPath: resolvedBase,
			usedIds,
		});

		return {
			[catalogId]: catalogs.fromEnv || {},
		};
	}

	return catalogsMap;
};

const loadAllConfigs = async ({ currentDirectory = '', ...externalConfigs }): Promise<AllServerConfigs> => {
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

export default loadAllConfigs;
