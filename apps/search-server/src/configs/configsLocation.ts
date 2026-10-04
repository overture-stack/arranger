import path from 'node:path';

import { ENV_MIGRATION_URL } from './fromEnv/renamedEnvs.js';

/** Where 3.0 resolved a relative configuration path from, beneath the directory the server starts in. */
const VERSION_3_BASE = path.join('modules', 'server');

/** The directory a relative configuration path resolves from, and a deprecation notice where it is 3.0's. */
export type ConfigsLocation = {
	currentDirectory: string;
	notice?: { code: 'ARRANGER_CONFIGS_LOCATION'; message: string };
};

/**
 * Decides which directory a relative configuration path resolves from. This server resolves it from
 * the directory it starts in. Where that names no directory, but the same path resolved from
 * `modules/server` beneath it does, as 3.0 resolved it, a deployment laid out for 3.0 is read from
 * there, with a deprecation notice naming both locations. An absolute path never falls back.
 *
 * @param args.catalogueConfigsPath the configuration path, as `CONFIGS_PATH` or its default gives it.
 * @param args.currentDirectory the directory the server starts in.
 * @param args.exists whether a directory exists at a path, injected so the decision stays pure.
 */
export const resolveConfigsLocation = ({
	catalogueConfigsPath,
	currentDirectory,
	exists,
}: {
	catalogueConfigsPath: string;
	currentDirectory: string;
	exists: (candidate: string) => boolean;
}): ConfigsLocation => {
	const expectedPath = path.resolve(currentDirectory, catalogueConfigsPath);
	const version3Directory = path.resolve(currentDirectory, VERSION_3_BASE);
	const version3Path = path.resolve(version3Directory, catalogueConfigsPath);

	const fallsBack = !path.isAbsolute(catalogueConfigsPath) && !exists(expectedPath) && exists(version3Path);

	return fallsBack
		? {
				currentDirectory: version3Directory,
				notice: {
					code: 'ARRANGER_CONFIGS_LOCATION',
					message:
						`Reading the configuration from ${version3Path}, where 3.0 resolved it, since ${expectedPath} does not exist. ` +
						`That location is deprecated: move the configuration to ${expectedPath}, or set CONFIGS_PATH to ${version3Path}. ` +
						`See ${ENV_MIGRATION_URL}#configs-directory`,
				},
			}
		: { currentDirectory };
};
