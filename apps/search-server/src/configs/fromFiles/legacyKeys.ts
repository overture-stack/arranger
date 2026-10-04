import { ENV_MIGRATION_URL } from '#configs/fromEnv/renamedEnvs.js';

/** A deprecation warning about a catalogue's configuration files, printed once when they load. */
export type ConfigNotice = {
	code: 'ARRANGER_CONFIG_RENAMED';
	message: string;
};

/**
 * Reads the top-level `index` that 3.0's configuration files named the search index with as
 * `esIndex`, the key 3.1 reads, where the files set no `esIndex` of their own. A file's `esIndex`
 * wins where both are set. Applied to the files' own content, before it is laid over the
 * environment's, so a file's index still overrides `ES_INDEX` as it did in 3.0.
 *
 * @param args.configsFromFiles the catalogue's configuration files, merged, before the environment's.
 * @param args.configsPath where the files were read from, which the notice names.
 * @returns the configuration to use, and a notice wherever `index` was set.
 */
export const renameLegacyIndexKey = ({
	configsFromFiles,
	configsPath,
}: {
	configsFromFiles: Record<string, unknown>;
	configsPath: string;
}): { configs: Record<string, unknown>; notice?: ConfigNotice } => {
	const { index, ...rest } = configsFromFiles;

	if (index === undefined) {
		return { configs: configsFromFiles };
	}

	const hasEsIndex = rest.esIndex !== undefined;
	const message = hasEsIndex
		? `In ${configsPath}, "index" is ignored because "esIndex" is also set, and the server reads "esIndex".`
		: `In ${configsPath}, "index" is deprecated: name it "esIndex" instead.`;

	return {
		configs: hasEsIndex ? rest : { ...rest, esIndex: index },
		notice: { code: 'ARRANGER_CONFIG_RENAMED', message: `${message} See ${ENV_MIGRATION_URL}#config-index-key` },
	};
};
