import { ENV_MIGRATION_URL, isTrueToVersion3 } from './renamedEnvs.js';

/** A warning about a value 3.1 reads differently from 3.0, where nothing is deprecated. */
export type MeaningChangedNotice = {
	code: 'ARRANGER_ENV_MEANING_CHANGED';
	message: string;
};

/**
 * Names, once at startup, an ENABLE_ADMIN that turns admin on although 3.0 read its value as off, such
 * as `1` or a padded `true`. Admin exposes each catalogue's index mapping, so a deployment upgraded from
 * 3.0 hears that it now does. Other flags keep 3.1's reading silently, since none adds a surface. The
 * notice never repeats the value.
 *
 * @param args.enabled whether 3.1's boolean rule read ENABLE_ADMIN as on.
 * @param args.value ENABLE_ADMIN as the environment holds it.
 * @returns the notice, or undefined where 3.0 and 3.1 read the value alike.
 */
export const adminFlagNotice = ({
	enabled,
	value,
}: {
	enabled: boolean;
	value: string | undefined;
}): MeaningChangedNotice | undefined =>
	enabled && !isTrueToVersion3(value ?? '')
		? {
				code: 'ARRANGER_ENV_MEANING_CHANGED',
				message: `ENABLE_ADMIN turns admin on, exposing each catalogue's index mapping, though 3.0 read its value as off: 3.1 reads \`1\`, and \`true\` with spaces around it, as true. Set it to \`true\` to keep admin on without this notice, or remove it to turn admin off. See ${ENV_MIGRATION_URL}#boolean-environment-flags`,
			}
		: undefined;
