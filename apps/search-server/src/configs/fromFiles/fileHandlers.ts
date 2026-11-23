import fs from 'fs';
import path from 'path';

import { merge } from 'lodash-es';

import { fileSettingKey, parseCatalogueFiles } from '../catalogueFileSchema.js';
import { startupRefusal } from '../fromEnv/enableAccessControl.js';

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
 * The file holding a catalogue's registration with Usher's Bridge, under its `auth` key. Read on its own
 * and never merged into the catalogue's configuration, since the GraphQL router has no use for it.
 */
export const USHER_REGISTRATION_FILE = 'auth.json';

/** The key holding a catalogue's registration, in its `auth.json` and in no other file. */
const AUTH_KEY = 'auth';

/**
 * The name of the error refusing where a catalogue's registration is written, which stops startup
 * instead of skipping the catalogue, so a catalogue is never served under rules assembled elsewhere.
 */
export const AUTH_PLACEMENT_REFUSAL = 'AuthPlacementRefusal';

/** A startup refusal about where a catalogue's registration is written, logged as `access_enforcement.startup_refused`. */
const authPlacementRefusal = (reason: string): Error =>
	Object.assign(startupRefusal(reason), { name: AUTH_PLACEMENT_REFUSAL });

/** Whether a configuration file's parsed contents carry the `auth` key at their top level. */
const carriesAuthKey = (contents: unknown): boolean =>
	typeof contents === 'object' && contents !== null && Object.hasOwn(contents, AUTH_KEY);

/** Whether an `auth.json`'s parsed contents are an object holding the `auth` key and nothing else. */
const holdsAuthAlone = (contents: unknown): contents is Readonly<Record<typeof AUTH_KEY, unknown>> =>
	typeof contents === 'object' &&
	contents !== null &&
	!Array.isArray(contents) &&
	Object.keys(contents).length === 1 &&
	Object.hasOwn(contents, AUTH_KEY);

const isDataFile = (fileName: string) => {
	const fileNameParts = fileName.split('.');

	return fileNameParts[fileNameParts.length - 1]?.toLowerCase() === 'json';
};

const isConfigurationFile = (fileName: string) => isDataFile(fileName) && fileName !== USHER_REGISTRATION_FILE;

/** `auth.json`'s text, parsed, or an error naming the file when it is not JSON. */
const parseRegistrationFile = (text: string, configsPath: string): unknown => {
	try {
		return JSON.parse(text);
	} catch {
		throw new Error(`Could not parse configuration file "${USHER_REGISTRATION_FILE}" in "${configsPath}"`);
	}
};

/**
 * The catalogue's registration as its `auth.json` holds it under the `auth` key, or undefined where there
 * is no `auth.json`.
 *
 * @throws {Error} a startup refusal when `auth.json` holds anything but the `auth` key.
 */
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

	const contents = parseRegistrationFile(text, configsPath);

	if (!holdsAuthAlone(contents)) {
		throw authPlacementRefusal(
			`Configuration file "${USHER_REGISTRATION_FILE}" in "${configsPath}" must hold one key, ${AUTH_KEY}, with the catalogue's registration.`,
		);
	}

	return contents[AUTH_KEY];
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

	const parsedFiles = files.map(([fileName, fileData]) => {
		try {
			return { contents: JSON.parse(fileData) as unknown, fileName };
		} catch (err) {
			enableDebug && console.debug(`\n  DEBUG: ${err}`);
			throw new Error(`Could not parse configuration file "${fileName}.json" in "${configsPath}"`);
		}
	});

	parsedFiles.forEach(({ contents, fileName }) => {
		if (carriesAuthKey(contents)) {
			throw authPlacementRefusal(
				`The ${AUTH_KEY} key belongs in ${USHER_REGISTRATION_FILE} alone, and configuration file "${fileName}.json" in "${configsPath}" carries one.`,
			);
		}
	});

	const configsFromFiles = parsedFiles.reduce<Record<string, unknown>>(
		(configsAcc, { contents }) => merge({}, configsAcc, normalize(contents)),
		{},
	);

	const { configs: renamedConfigs, notice } = renameLegacyIndexKey({ configsFromFiles, configsPath });

	if (notice) {
		process.emitWarning(notice.message, { code: notice.code, type: 'DeprecationWarning' });
	}

	const configs = parseCatalogueFiles({
		catalogueFolder: path.basename(configsPath),
		configs: renamedConfigs,
		sourceFileOf: (key) => fileSettingKey(parsedFiles, key),
	});

	// Into a fresh object, so the environment's configuration, shared by every catalogue, is never written to.
	return [configsPath, merge({}, baseConfig, configs), usherRegistration];
};

export default getConfigFromFiles;
