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
	catalogueConfigsPath,
	currentDirectory,
	enableDebug,
}) => {
	console.log(`  - Looking for files in '${catalogueConfigsPath}'...`);
	const configsPath = path.resolve(currentDirectory, catalogueConfigsPath);

	enableDebug && console.debug('\n    DEBUG: resolved configs path:', configsPath);

	const filenames = await readDirectoryAsync(configsPath);
	const files = (
		await Promise.all(
			(filenames as string[]).filter(isDataFile).map((filename) => readFileAsync(configsPath, filename, 'utf8')),
		)
	).filter((file): file is [string, string] => file !== undefined);

	if (files.length === 0) {
		return [configsPath, { ...baseConfig }];
	}

	const aggregatedConfigs = files.reduce((configsAcc, [fileName, fileData]) => {
		try {
			const fileDataJSON = JSON.parse(fileData);
			const normalizedJSON = normalize(fileDataJSON);

			return merge({}, configsAcc, normalizedJSON);
		} catch (err) {
			enableDebug && console.debug(`\n  DEBUG: ${err}`);
			throw new Error(`Could not parse configuration file "${fileName}.json" in "${configsPath}"`);
		}
	}, { ...baseConfig });

	return [configsPath, aggregatedConfigs];
};

export default getConfigFromFiles;
