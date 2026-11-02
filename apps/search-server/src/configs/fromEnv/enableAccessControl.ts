import { includeEverything } from '@overture-stack/arranger-graphql-router';

import type { ExternalConfigs } from '#configs/types/index.js';

/**
 * ENABLE_ACCESS_ENFORCEMENT as the environment set it. Only `true`, `1`, `false` and `0` are recognized,
 * trimmed and in any case; every other value, an empty one included, keeps its raw text for the refusal. The
 * variable's earlier name, ENABLE_ACCESS_CONTROL, set to anything, empty included, is `retired`.
 */
export type EnableAccessControlSetting =
	| { rawValue: string; setting: 'unrecognized' }
	| { setting: 'disabled' }
	| { setting: 'enabled' }
	| { setting: 'retired' }
	| { setting: 'unset' };

/**
 * The filter callback the image hands every catalogue's router, left out when the router should apply its own
 * default, and the two things the image logs about that choice: whether access enforcement is on, and how
 * ENABLE_ACCESS_ENFORCEMENT decided it, and where the server-side filter comes from. A server-side filter scopes
 * data, for reasons that need not concern principals at all, so an embedding application's filter applies whether
 * access enforcement is off by default or by choice.
 */
export type ImageAccessControl = {
	enforcement:
		| 'off (ENABLE_ACCESS_ENFORCEMENT false)'
		| 'off (ENABLE_ACCESS_ENFORCEMENT unset)'
		| 'on (ENABLE_ACCESS_ENFORCEMENT true)';
	filterSource: 'none' | 'the embedding application' | 'Usher';
	getServerSideFilter?: ExternalConfigs['filters'];
};

const recognizedSettings = new Map<string, 'disabled' | 'enabled'>([
	['0', 'disabled'],
	['1', 'enabled'],
	['false', 'disabled'],
	['true', 'enabled'],
]);

/**
 * Reads ENABLE_ACCESS_ENFORCEMENT without the shared boolean parser's fallback, since a mistyped value
 * falling back to a default could switch access enforcement off unnoticed. The variable's earlier name, set at
 * all, is read as retired whatever the new one holds, since a deployment still setting it would otherwise read as
 * unset, with enforcement off. Never throws: startup refuses.
 *
 * @param rawValue the variable's raw text, or undefined when it is unset.
 * @param retiredRawValue ENABLE_ACCESS_CONTROL's raw text, or undefined when it is unset.
 */
export const parseEnableAccessControl = (
	rawValue: string | undefined,
	retiredRawValue?: string,
): EnableAccessControlSetting => {
	if (retiredRawValue !== undefined) {
		return { setting: 'retired' };
	}

	if (rawValue === undefined) {
		return { setting: 'unset' };
	}

	const setting = recognizedSettings.get(rawValue.trim().toLowerCase());

	return setting ? { setting } : { rawValue, setting: 'unrecognized' };
};

/**
 * Logs `reason` as one line under `access_enforcement.startup_refused`, and returns the error refusing startup.
 *
 * @param reason fixed text naming what is wrong, never a value it found.
 */
export const startupRefusal = (reason: string): Error => {
	console.error('access_enforcement.startup_refused', reason);
	return new Error(reason);
};

/**
 * Decides what the image passes every catalogue's router, or refuses startup when ENABLE_ACCESS_ENFORCEMENT
 * cannot be honoured. A host's `filters` or `getRequester` option counts as given whenever it is not undefined,
 * null included. Every refusal is also logged, as one line under the event name `access_enforcement.startup_refused`.
 *
 * @param details the parsed ENABLE_ACCESS_ENFORCEMENT, and the host's programmatic `filters` and `getRequester`.
 * With ENABLE_ACCESS_ENFORCEMENT true, every catalogue's callback and requester answer come from the Usher adapter
 * instead, so none is chosen here.
 * @throws {Error} when ENABLE_ACCESS_CONTROL is set, when ENABLE_ACCESS_ENFORCEMENT is unrecognized, or when it is
 *   true beside a filters or getRequester option.
 */
export const resolveImageAccessControl = ({
	enableAccessControl,
	filters,
	getRequester,
}: {
	enableAccessControl: EnableAccessControlSetting;
	filters: ExternalConfigs['filters'];
	getRequester?: ExternalConfigs['getRequester'];
}): ImageAccessControl => {
	if (enableAccessControl.setting === 'retired') {
		throw startupRefusal(
			'ENABLE_ACCESS_CONTROL is set, but the variable that turns on access enforcement is ENABLE_ACCESS_ENFORCEMENT, and the server will not guess what the earlier name meant. Set ENABLE_ACCESS_ENFORCEMENT instead, and remove ENABLE_ACCESS_CONTROL.',
		);
	}

	if (enableAccessControl.setting === 'unset' || enableAccessControl.setting === 'disabled') {
		const enforcement =
			enableAccessControl.setting === 'unset'
				? 'off (ENABLE_ACCESS_ENFORCEMENT unset)'
				: 'off (ENABLE_ACCESS_ENFORCEMENT false)';

		if (filters !== undefined) {
			return { enforcement, filterSource: 'the embedding application', getServerSideFilter: filters };
		}

		return enableAccessControl.setting === 'unset'
			? { enforcement, filterSource: 'none' }
			: { enforcement, filterSource: 'none', getServerSideFilter: includeEverything };
	}

	if (enableAccessControl.setting === 'enabled') {
		if (filters !== undefined) {
			throw startupRefusal(
				"The code starting this server passes it a `filters` function while ENABLE_ACCESS_ENFORCEMENT is true, but Arranger cannot yet apply both to the same catalogue. Remove `filters` from that code to use Usher's access enforcement alone, or unset ENABLE_ACCESS_ENFORCEMENT to use that function alone.",
			);
		}

		if (getRequester !== undefined) {
			throw startupRefusal(
				"The code starting this server passes it a `getRequester` function while ENABLE_ACCESS_ENFORCEMENT is true, but with Usher's access enforcement, who made a request comes from Usher alone. Remove `getRequester` from that code to use Usher's access enforcement, or unset ENABLE_ACCESS_ENFORCEMENT to use that function.",
			);
		}

		return { enforcement: 'on (ENABLE_ACCESS_ENFORCEMENT true)', filterSource: 'Usher' };
	}

	throw startupRefusal(
		`ENABLE_ACCESS_ENFORCEMENT must be true, 1, false or 0 when set, but is ${JSON.stringify(enableAccessControl.rawValue)}, so the server will not guess whether access enforcement was meant to be on.`,
	);
};
