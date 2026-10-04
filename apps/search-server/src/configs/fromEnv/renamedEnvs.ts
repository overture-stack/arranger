import { createRequire } from 'node:module';

/** A 3.0 environment variable renamed in 3.1, still read under its 3.0 name as a deprecated alias. */
type RenamedEnv = {
	/** The name 3.1 reads. */
	current: string;
	/**
	 * Reads a value set under the 3.0 name the way 3.0 read it, returning text 3.1 reads with the same
	 * meaning, or undefined where 3.0 read it as the variable's default.
	 */
	fromPrevious: (value: string) => string | undefined;
	/**
	 * Whether a value set under the 3.0 name is Arranger's to read. Absent means always, which holds
	 * for every name but one that other tools also read for settings of their own.
	 */
	isArrangerValue?: (value: string) => boolean;
	/** The name 3.0 read. */
	previous: string;
};

/** A 3.0 environment variable nothing reads in 3.1, and what to do instead of setting it. */
type UnreadEnv = {
	instead: string;
	name: string;
};

/** A deprecation warning to print at startup, under a code an operator can filter or search for. */
export type EnvNotice = {
	code: 'ARRANGER_ENV_RENAMED' | 'ARRANGER_ENV_UNREAD';
	message: string;
};

const isRecord = (value: unknown): value is Record<PropertyKey, unknown> => typeof value === 'object' && value !== null;

/**
 * Where the migration guide lives for the given version: on that release's tag, so a printed link keeps
 * describing the version that printed it, or on the main branch for a development build, which has no tag.
 */
export const migrationGuideUrlFor = (version: string): string =>
	`https://github.com/overture-stack/arranger/blob/${
		version && version !== '0.0.0-dev' ? `search-server-v${version}` : 'main'
	}/docs/reference/08-Migration/v3.1.md`;

// From src/configs/fromEnv, three levels below the package root.
const packageJson: unknown = createRequire(import.meta.url)('../../../package.json');

/** The migration guide for this build of the search server. */
export const ENV_MIGRATION_URL = migrationGuideUrlFor(
	isRecord(packageJson) && typeof packageJson.version === 'string' ? packageJson.version : '',
);

// 3.0 read a flag as true only for the text `true`, in any case and untrimmed, and as false otherwise.
const isTrueToVersion3 = (value: string): boolean => value.toLowerCase() === 'true';
const fromVersion3Flag = (value: string): string | undefined => (isTrueToVersion3(value) ? 'true' : undefined);

// 3.0 read a number as `Number(value) || default`, so zero, and text that is no number, took the default.
const fromVersion3Number = (value: string): string | undefined => {
	const number = Number(value);

	return Number.isFinite(number) && number !== 0 ? String(number) : undefined;
};

// 3.0 read text as `value || default`, which a set value always passes.
const fromVersion3Text = (value: string): string => value;

/** Every renamed variable, by its 3.0 name. */
export const RENAMED_ENVS: RenamedEnv[] = [
	{
		current: 'ALLOW_CUSTOM_DOWNLOAD_MAX_ROWS',
		fromPrevious: fromVersion3Flag,
		previous: 'ALLOW_CUSTOM_MAX_DOWNLOAD_ROWS',
	},
	{ current: 'CONFIGS_PATH', fromPrevious: fromVersion3Text, previous: 'CONFIG_PATH' },
	// Other tools read DEBUG for settings of their own, such as `express:*`, and 3.0 read anything but `true` as false.
	{ current: 'ENABLE_DEBUG', fromPrevious: fromVersion3Flag, isArrangerValue: isTrueToVersion3, previous: 'DEBUG' },
	{ current: 'ES_ARRANGER_SETS_INDEX', fromPrevious: fromVersion3Text, previous: 'ES_ARRANGER_SET_INDEX' },
	{ current: 'ES_ARRANGER_SETS_TYPE', fromPrevious: fromVersion3Text, previous: 'ES_ARRANGER_SET_TYPE' },
	{ current: 'SERVER_PORT', fromPrevious: fromVersion3Number, previous: 'PORT' },
	{ current: 'SEARCH_ENGINE', fromPrevious: fromVersion3Text, previous: 'SEARCH_CLIENT_TYPE' },
];

/** Every 3.0 variable no longer read, by name. */
export const UNREAD_ENVS: UnreadEnv[] = [
	{ instead: 'remove it', name: 'ES_LOG' },
	// 3.0 read it, then looked for its value where it was never stored, so no 3.0 export was ever limited by it.
	{ instead: '3.0 never applied it either, so set DOWNLOAD_MAX_ROWS to limit exports', name: 'MAX_DOWNLOAD_ROWS' },
	{ instead: 'remove it', name: 'MAX_LIVE_VERSIONS' },
];

/** Whether a variable holds a value: a blank one counts as unset, as every reader of it treats it. */
const isSet = (value: string | undefined): value is string => value !== undefined && value.trim() !== '';

/** The value set under a renamed variable's 3.0 name, when there is one and it is Arranger's to read. */
const previousValueOf = (
	{ isArrangerValue = () => true, previous }: RenamedEnv,
	env: NodeJS.ProcessEnv,
): string | undefined => {
	const value = env[previous];

	return isSet(value) && isArrangerValue(value) ? value : undefined;
};

const renamedNotice = (renamed: RenamedEnv, env: NodeJS.ProcessEnv): EnvNotice[] => {
	const { current, previous } = renamed;
	const previousValue = previousValueOf(renamed, env);
	const currentValue = env[current];

	// Both names holding the same value, as where SERVER_PORT is set from a platform's PORT, ignore nothing.
	if (previousValue === undefined || (isSet(currentValue) && currentValue.trim() === previousValue.trim())) {
		return [];
	}

	// A value 3.0 read as the default would change what the server does if copied to the new name, which
	// reads it differently, so the advice for it is to remove it.
	const message = isSet(currentValue)
		? `${previous} is ignored because ${current} is also set, to a different value, and the server reads ${current}.`
		: renamed.fromPrevious(previousValue) === undefined
			? `${previous} has no effect, as in 3.0, which read its value as the default: remove ${previous}, and set ${current} only to change the default.`
			: `${previous} is deprecated: set ${current} instead.`;

	return [
		{ code: 'ARRANGER_ENV_RENAMED', message: `${message} See ${ENV_MIGRATION_URL}#environment-variable-renames` },
	];
};

const unreadNotice = ({ instead, name }: UnreadEnv, env: NodeJS.ProcessEnv): EnvNotice[] =>
	isSet(env[name])
		? [
				{
					code: 'ARRANGER_ENV_UNREAD',
					message: `${name} is no longer read and has no effect: ${instead}. See ${ENV_MIGRATION_URL}#environment-variables-no-longer-read`,
				},
			]
		: [];

/**
 * Reads the 3.0 names of renamed variables as their 3.1 names, for an environment still setting them.
 * A 3.0 value means what 3.0 read it as, and a 3.1 name that is set always wins. Returns the environment
 * to read, with each 3.1 name filled from its 3.0 name where only that one is set and 3.0 read it as
 * more than the default, and a notice for every 3.0 name set and every variable set that is no longer
 * read. A notice names variables and never repeats a value.
 *
 * @param env the environment as the process received it, which this does not change.
 */
export const resolveRenamedEnvs = (env: NodeJS.ProcessEnv): { env: NodeJS.ProcessEnv; notices: EnvNotice[] } => {
	const aliases = RENAMED_ENVS.flatMap((renamed) => {
		const previousValue = previousValueOf(renamed, env);
		const translated = previousValue === undefined ? undefined : renamed.fromPrevious(previousValue);

		return translated !== undefined && !isSet(env[renamed.current]) ? [[renamed.current, translated]] : [];
	});

	return {
		env: { ...env, ...Object.fromEntries(aliases) },
		notices: [
			...RENAMED_ENVS.flatMap((renamed) => renamedNotice(renamed, env)),
			...UNREAD_ENVS.flatMap((unread) => unreadNotice(unread, env)),
		],
	};
};
