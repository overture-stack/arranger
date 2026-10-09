import { includeEverything } from '@overture-stack/arranger-graphql-router';

import type { ExternalConfigs } from '#configs/types/index.js';

/**
 * ENABLE_ACCESS_CONTROL as the environment set it. Only `true`, `1`, `false` and `0` are recognized,
 * trimmed and in any case; every other value, an empty one included, keeps its raw text for the refusal.
 */
export type EnableAccessControlSetting =
	| { rawValue: string; setting: 'unrecognized' }
	| { setting: 'disabled' }
	| { setting: 'enabled' }
	| { setting: 'unset' };

/**
 * The filter callback the image hands every catalogue's router, left out when the router should apply
 * its own default, and the source the image logs for that choice.
 */
export type ImageAccessControl = {
	getServerSideFilter?: ExternalConfigs['filters'];
	source: 'configured by host' | 'defaulted (unset)' | 'explicit (set to false)' | 'Usher adapter';
};

const recognizedSettings = new Map<string, 'disabled' | 'enabled'>([
	['0', 'disabled'],
	['1', 'enabled'],
	['false', 'disabled'],
	['true', 'enabled'],
]);

/**
 * Reads ENABLE_ACCESS_CONTROL without the shared boolean parser's fallback, since a mistyped value
 * falling back to a default could switch access control off unnoticed. Never throws: startup refuses.
 *
 * @param rawValue the variable's raw text, or undefined when it is unset.
 */
export const parseEnableAccessControl = (rawValue: string | undefined): EnableAccessControlSetting => {
	if (rawValue === undefined) {
		return { setting: 'unset' };
	}

	const setting = recognizedSettings.get(rawValue.trim().toLowerCase());

	return setting ? { setting } : { rawValue, setting: 'unrecognized' };
};

/**
 * Logs `reason` as one line under `access_control.startup_refused`, and returns the error refusing startup.
 *
 * @param reason fixed text naming what is wrong, never a value it found.
 */
export const startupRefusal = (reason: string): Error => {
	console.error('access_control.startup_refused', reason);
	return new Error(reason);
};

/**
 * Decides what the image passes every catalogue's router, or refuses startup when ENABLE_ACCESS_CONTROL
 * cannot be honoured. A host's `filters` option counts as given whenever it is not undefined, null included.
 * Every refusal is also logged, as one line under the event name `access_control.startup_refused`.
 *
 * @param enableAccessControl the parsed ENABLE_ACCESS_CONTROL.
 * @param filters the host's programmatic filters option.
 * With ENABLE_ACCESS_CONTROL true, every catalogue's callback comes from the Usher adapter instead,
 * so none is chosen here.
 * @throws {Error} when ENABLE_ACCESS_CONTROL is unrecognized, or set alongside a filters option.
 */
export const resolveImageAccessControl = ({
	enableAccessControl,
	filters,
}: {
	enableAccessControl: EnableAccessControlSetting;
	filters: ExternalConfigs['filters'];
}): ImageAccessControl => {
	if (enableAccessControl.setting === 'unset') {
		return filters === undefined
			? { source: 'defaulted (unset)' }
			: { getServerSideFilter: filters, source: 'configured by host' };
	}

	if (enableAccessControl.setting === 'disabled') {
		if (filters === undefined) {
			return { getServerSideFilter: includeEverything, source: 'explicit (set to false)' };
		}

		throw startupRefusal(
			'ENABLE_ACCESS_CONTROL is false, which contradicts the filters option this server was given. Unset ENABLE_ACCESS_CONTROL to apply those filters, or leave filters out if this deployment applies no access control.',
		);
	}

	if (enableAccessControl.setting === 'enabled') {
		if (filters === undefined) {
			return { source: 'Usher adapter' };
		}

		throw startupRefusal(
			'ENABLE_ACCESS_CONTROL is true, which applies the Usher adapter, and a filters option does not stand in for it. Leave filters out, or unset ENABLE_ACCESS_CONTROL to apply those filters instead.',
		);
	}

	throw startupRefusal(
		`ENABLE_ACCESS_CONTROL must be true, 1, false or 0 when set, but is ${JSON.stringify(enableAccessControl.rawValue)}, so the server will not guess whether access control was meant to be on.`,
	);
};
