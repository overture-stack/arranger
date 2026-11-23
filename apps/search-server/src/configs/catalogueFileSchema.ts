import { configFeatureFlagProperties, configRootProperties } from '@overture-stack/arranger-types/configs/constants';
import { z as zod } from 'zod';

/** The name of the error refusing a catalogue's configuration files, which stops startup instead of skipping the catalogue. */
export const CATALOGUE_FILE_REFUSAL = 'CatalogueFileRefusal';

/** The configuration file that sets a key, or undefined when no single file is known to set it. */
export type SourceFileOf = (key: string) => string | undefined;

/** The event a catalogue-file refusal is logged under, separate from access enforcement's refusals. */
const CONFIGS_REFUSAL_EVENT = 'configs.startup_refused';

/**
 * Logs a refusal of a catalogue's configuration files under its own event, with the catalogue, the file when it is
 * known, and the key, but never the value, and returns the error refusing startup.
 */
const catalogueFileRefusal = ({
	catalogueFolder,
	file,
	key,
	reason,
}: {
	catalogueFolder: string;
	file: string | undefined;
	key: string;
	reason: string;
}): Error => {
	console.error(CONFIGS_REFUSAL_EVENT, reason, {
		catalogue: catalogueFolder,
		...(file === undefined ? {} : { file }),
		key,
	});

	return Object.assign(new Error(reason), { name: CATALOGUE_FILE_REFUSAL });
};

/** The rule a value of the wrong type breaks, named in the refusal in place of the value itself. */
const ruleByExpectedType: Readonly<Record<string, string>> = {
	boolean: 'must be true or false',
	number: 'must be a number',
	string: 'must be a string',
};

/**
 * The top-level keys a catalogue's configuration files may set, each with the type it must have. Every boolean
 * feature flag is listed, and the scalar keys of the catalogue's base configuration. Keys not listed, and the
 * nested sections, are left unvalidated.
 */
const catalogueFileShape = zod.looseObject({
	[configRootProperties.CATALOG_ID]: zod.string().optional(),
	[configRootProperties.DESCRIPTION]: zod.string().optional(),
	[configRootProperties.DOCUMENT_TYPE]: zod.string().optional(),
	[configRootProperties.ES_HOST]: zod.string().optional(),
	[configRootProperties.ES_INDEX]: zod.string().optional(),
	[configRootProperties.ES_PASS]: zod.string().optional(),
	[configRootProperties.ES_USER]: zod.string().optional(),
	[configRootProperties.GRAPHQL_MAX_ALIASES]: zod.number().optional(),
	[configRootProperties.GRAPHQL_MAX_DEPTH]: zod.number().optional(),
	[configRootProperties.NESTING_PREFIX]: zod.string().optional(),
	[configRootProperties.SEARCH_ENGINE]: zod.string().optional(),
	...Object.fromEntries(Object.values(configFeatureFlagProperties).map((flag) => [flag, zod.boolean().optional()])),
});

/**
 * The name of the configuration file that alone sets a key, for the refusal to name, or undefined when none does
 * or several do.
 */
export const fileSettingKey = (
	files: readonly { contents: unknown; fileName: string }[],
	key: string,
): string | undefined => {
	const setters = files.filter(
		({ contents }) => typeof contents === 'object' && contents !== null && Object.hasOwn(contents, key),
	);

	return setters.length === 1 ? `${setters[0]?.fileName}.json` : undefined;
};

/**
 * Checks the merged configuration files of one catalogue, before the catalogue registers, and returns them as
 * parsed. A flag set to anything but a JSON boolean, or a scalar set to the wrong type, refuses startup. The
 * refusal names the catalogue, the file where it is known, the key and the rule, and never the value.
 *
 * @param args.catalogueFolder the folder the catalogue's files were read from, named in the refusal.
 * @param args.configs the catalogue's configuration files, merged, before the environment's.
 * @param args.sourceFileOf the file that sets a key, where one is known.
 * @returns the configuration, unchanged.
 * @throws {Error} a startup refusal, named `CATALOGUE_FILE_REFUSAL`, for the first key set to the wrong type.
 */
export const parseCatalogueFiles = ({
	catalogueFolder,
	configs,
	sourceFileOf = () => undefined,
}: {
	catalogueFolder: string;
	configs: Readonly<Record<string, unknown>>;
	sourceFileOf?: SourceFileOf;
}): Record<string, unknown> => {
	const result = catalogueFileShape.safeParse(configs);

	if (result.success) {
		return result.data;
	}

	const [issue] = result.error.issues;
	const key = String(issue?.path[0]);
	const expectedType = issue?.code === 'invalid_type' ? issue.expected : undefined;
	const rule = (expectedType && ruleByExpectedType[expectedType]) || 'must be a valid value';
	const file = sourceFileOf(key);
	const subject = file ?? 'its configuration files';
	const verb = file === undefined ? 'set' : 'sets';
	const reason = `Catalogue "${catalogueFolder}": ${subject} ${verb} ${key}, which ${rule}.`;

	throw catalogueFileRefusal({ catalogueFolder, file, key, reason });
};
