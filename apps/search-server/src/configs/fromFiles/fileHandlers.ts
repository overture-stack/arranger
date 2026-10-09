import fs from 'fs';
import path from 'path';

import { merge } from 'lodash-es';

import { renameLegacyIndexKey } from './legacyKeys.js';
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

/**
 * The file holding a catalogue's registration with Usher's bridge. Read on its own and never merged
 * into the catalogue's configuration, since the GraphQL router has no use for it.
 */
export const USHER_REGISTRATION_FILE = 'usher.json';

const isDataFile = (fileName: string) => {
	const fileNameParts = fileName.split('.');

	return fileNameParts[fileNameParts.length - 1]?.toLowerCase() === 'json';
};

const isConfigurationFile = (fileName: string) => isDataFile(fileName) && fileName !== USHER_REGISTRATION_FILE;

/** The catalogue's registration as its `usher.json` holds it, parsed, or undefined where there is none. */
const readUsherRegistration = async (configsPath: string): Promise<unknown> => {
	const text = await fs.promises.readFile(path.join(configsPath, USHER_REGISTRATION_FILE), 'utf8').catch((error) => {
		if (error?.code === 'ENOENT') {
			return undefined;
		}
		throw error;
	});

	if (text === undefined) {
		return undefined;
	}

	try {
		return JSON.parse(text);
	} catch {
		throw new Error(`Could not parse configuration file "${USHER_REGISTRATION_FILE}" in "${configsPath}"`);
	}
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
			(filenames as string[])
				.filter(isConfigurationFile)
				.map((filename) => readFileAsync(configsPath, filename, 'utf8')),
		)
	).filter((file): file is [string, string] => file !== undefined);

	const usherRegistration = await readUsherRegistration(configsPath);

	if (files.length === 0) {
		return [configsPath, { ...baseConfig }, usherRegistration];
	}

	const configsFromFiles = files.reduce<Record<string, unknown>>((configsAcc, [fileName, fileData]) => {
		try {
			const fileDataJSON = JSON.parse(fileData);
			const normalizedJSON = normalize(fileDataJSON);

			return merge({}, configsAcc, normalizedJSON);
		} catch (err) {
			enableDebug && console.debug(`\n  DEBUG: ${err}`);
			throw new Error(`Could not parse configuration file "${fileName}.json" in "${configsPath}"`);
		}
	}, {});

	const { configs, notice } = renameLegacyIndexKey({ configsFromFiles, configsPath });

	if (notice) {
		process.emitWarning(notice.message, { code: notice.code, type: 'DeprecationWarning' });
	}

	// Into a fresh object, so the environment's configuration, shared by every catalogue, is never written to.
	return [configsPath, merge({}, baseConfig, configs), usherRegistration];
};

export default getConfigFromFiles;
