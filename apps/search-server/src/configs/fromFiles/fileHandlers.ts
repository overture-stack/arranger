import fs from 'fs';
import path from 'path';

import { merge } from 'lodash-es';

import normalize from './normalize.js';
import type { ConfigsFromFilesFn, FileEncodingType } from './types.js';

const readDirectoryAsync = (dirname: string) =>
	new Promise((resolve, reject) =>
		fs.readdir(dirname, (err, filenames) => {
			err ? reject(err) : resolve(filenames);
		}),
	).catch((error) => {
		if (error?.code === 'ENOENT') {
			console.warn('    No config directory found. Skipping file-based configuration.');
		} else {
			console.error('    Could not find usable config files in that path.');
		}
		return [];
	});

const readFileAsync = (dirname: string, filename: string, encoding: FileEncodingType) =>
	new Promise((resolve, reject) =>
		fs.readFile(path.join(dirname, filename), encoding, (err, data) => {
			err ? reject(err) : resolve([filename.replace('.json', ''), data]);
		}),
	).catch((error) => {
		console.log('error?', error);
	});

const isDataFile = (fileName: string) => {
	const fileNameParts = fileName.split('.');

	return fileNameParts[fileNameParts.length - 1]?.toLowerCase() === 'json';
};

const getConfigFromFiles: ConfigsFromFilesFn = async ({
	baseConfig,
	catalogConfigsPath,
	currentDirectory,
	enableDebug,
}) => {
	console.log(`  - Looking for files in '${catalogConfigsPath}'...`);
	const configsPath = path.resolve(currentDirectory, catalogConfigsPath);

	enableDebug && console.debug('\n    DEBUG: resolved configs path:', configsPath);

	try {
		const aggregatedConfigs = await readDirectoryAsync(configsPath)
			.then((filenames = []) =>
				// TODO: shouldn't fail all files if one is broken
				Promise.all(
					(filenames as string[])
						.filter(isDataFile)
						.map((filename) => readFileAsync(configsPath, filename, 'utf8')),
				),
			)
			.then((files = []) => {
				if (files.length === 0) {
					return {};
				}

				const configObj = (files as [string, string][]).reduce(
					(configsAcc, [fileName, fileData]) => {
						try {
							const fileDataJSON = JSON.parse(fileData);

							const normalizedJSON = normalize(fileDataJSON);

							// if (fileDataJSON?.[configRootProperties.TABLE]?.[tableProperties.DEFAULT_SORTING]) {
							// 	return merge({}, configsAcc, fileDataJSON, {
							// 		[configRootProperties.TABLE]: {
							// 			...fileDataJSON[configRootProperties.TABLE],
							// 			[tableProperties.DEFAULT_SORTING]: fileDataJSON[configRootProperties.TABLE][
							// 				tableProperties.DEFAULT_SORTING
							// 			].map((sorting: SortingConfigs) => ({
							// 				...sorting,
							// 				desc: sorting.desc || false,
							// 			})),
							// 		},
							// 	});
							// }

							// return merge({}, configsAcc, fileDataJSON);

							return merge({}, configsAcc, normalizedJSON);
						} catch (err) {
							enableDebug && console.debug(`\n  DEBUG: ${err}`);
							throw new Error('Could not parse the provided configuration files');
						}
					},
					{ ...baseConfig },
				);

				return configObj;
			});

		return [configsPath, aggregatedConfigs];
	} catch (err) {
		console.warn(`    Something wrong happened when attempting to load config files ${err}`);

		return [configsPath, { ...baseConfig }];
	}
};

export default getConfigFromFiles;
