import { Abortable } from 'events';
import fs, { ObjectEncodingOptions } from 'fs';
import path from 'path';

import { merge } from 'lodash';

import { ENV_CONFIG } from '@/config';
import { ConfigObject, ConfigProperties, SortingConfigsInterface } from '@/config/types';

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
	) // this catches the
		.catch((error) => console.error(error.message || error));

const readFileAsync = (dirname: string, filename: string, encoding: FileEncodingType) =>
	new Promise((resolve, reject) =>
		fs.readFile(path.join(dirname, filename), encoding, (err, data) => {
			err ? reject(err) : resolve([filename.replace('.json', ''), data]);
		}),
	);

const isDataFile = (filename: string) => {
	const fileNameParts = filename.split('.');

	return fileNameParts[fileNameParts.length - 1].toLowerCase() === 'json';
};

const getConfigFromFiles = (dirname: string): Promise<ConfigObject> => {
	const configsPath = path.resolve(global.__basedir || '', dirname);
	console.log(`  Reading files from '${configsPath}'...`);

	const configsFromEnv = {
		[ConfigProperties.DOCUMENT_TYPE]: ENV_CONFIG.DOCUMENT_TYPE,
		[ConfigProperties.DOWNLOADS]: {
			[ConfigProperties.ALLOW_CUSTOM_MAX_DOWNLOAD_ROWS]: ENV_CONFIG.ALLOW_CUSTOM_MAX_DOWNLOAD_ROWS,
			[ConfigProperties.MAX_DOWNLOAD_ROWS]: ENV_CONFIG.MAX_DOWNLOAD_ROWS,
		},
		[ConfigProperties.INDEX]: ENV_CONFIG.ES_INDEX,
		[ConfigProperties.TABLE]: {
			[ConfigProperties.COLUMNS]: [],
			[ConfigProperties.MAX_RESULTS_WINDOW]: ENV_CONFIG.MAX_RESULTS_WINDOW,
		},
	};

	return readDirectoryAsync(configsPath)
		.then((filenames = []) =>
			Promise.all(
				(filenames as string[])
					.filter(isDataFile)
					.map((filename) => readFileAsync(configsPath, filename, 'utf8')),
			),
		)
		.then((files = []) => {
			if (files.length === 0) throw new Error('Could not find any config files');

			const configObj = (files as [string, any][]).reduce(
				(configsAcc: Partial<ConfigObject>, [fileName, fileData]) => {
					const fileDataJSON = JSON.parse(fileData);

					if (fileDataJSON?.[ConfigProperties.TABLE]?.[ConfigProperties.DEFAULT_SORTING]) {
						return merge({}, configsAcc, fileDataJSON, {
							[ConfigProperties.TABLE]: {
								...fileDataJSON[ConfigProperties.TABLE],
								[ConfigProperties.DEFAULT_SORTING]: fileDataJSON[ConfigProperties.TABLE][
									ConfigProperties.DEFAULT_SORTING
								].map((sorting: SortingConfigsInterface) => ({
									...sorting,
									desc: sorting.desc || false,
								})),
							},
						});
					}

					return merge({}, configsAcc, fileDataJSON);
				},
				configsFromEnv,
			);

			return configObj as ConfigObject;
		});
};

export default getConfigFromFiles;
