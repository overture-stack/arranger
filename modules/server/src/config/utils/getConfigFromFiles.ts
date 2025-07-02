import fs, { type ObjectEncodingOptions } from 'fs';
import { type Abortable } from 'node:events';
import path from 'path';

import { merge } from 'lodash-es';

import { configProperties } from '#config/types.js';
import type { ConfigObject, SortingConfigs } from '#config/types.js';

type FileEncodingType =
	| BufferEncoding
	| (ObjectEncodingOptions & { flag?: string | undefined } & Abortable)
	| null
	| undefined;

const readDirectoryAsync = (dirname: string) =>
	new Promise((resolve, reject) =>
		fs.readdir(dirname, (err, filenames) => {
			err ? reject(err) : resolve(filenames);
		}),
	).catch((error) => {
		console.error('  - Could not find usable config files in that path.');
		throw error;
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

const getConfigFromFiles = (dirname: string, configsFromEnv: Partial<ConfigObject>): Promise<ConfigObject> => {
	const configsPath = path.resolve(global.__basedir || '', dirname);
	console.log(`  - Looking for files in '${configsPath}'...`);

	return readDirectoryAsync(configsPath)
		.then((filenames = []) =>
			// TODO: shouldn't fail all files if one is broken
			Promise.all(
				(filenames as string[])
					.filter(isDataFile)
					.map((filename) => readFileAsync(configsPath, filename, 'utf8')),
			),
		)
		.then((files = []) => {
			if (files.length === 0) throw new Error('  - Could not find any config files');

			const configObj = (files as [string, string][]).reduce(
				(configsAcc: Partial<ConfigObject>, [fileName, fileData]) => {
					try {
						const fileDataJSON = JSON.parse(fileData);

						if (fileDataJSON?.[configProperties.TABLE]?.[configProperties.DEFAULT_SORTING]) {
							return merge({}, configsAcc, fileDataJSON, {
								[configProperties.TABLE]: {
									...fileDataJSON[configProperties.TABLE],
									[configProperties.DEFAULT_SORTING]: fileDataJSON[configProperties.TABLE][
										configProperties.DEFAULT_SORTING
									].map((sorting: SortingConfigs) => ({
										...sorting,
										desc: sorting.desc || false,
									})),
								},
							});
						}

						return merge({}, configsAcc, fileDataJSON);
					} catch (e) {
						throw new Error('Could not parse the provided configuration files');
					}
				},
				configsFromEnv,
			);

			return configObj as ConfigObject;
		});
};

export default getConfigFromFiles;
