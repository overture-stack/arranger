import type { BridgeCore, KeyRegistration, ResolveOutcome } from '@overture-stack/usher-bridge--express';
import { anonymousAccess, openTierAccess, signedInAccess } from '@overture-stack/usher-bridge--express/testing';
import type { Enforcement } from '@overture-stack/usher-types';

import { withArtifactCreateAllowed } from './accessResults.js';

type Results = Readonly<Record<string, Enforcement>>;

/** The fake Bridge, with what it recorded. */
export type FakeBridge = Readonly<{
	core: BridgeCore;

	/** Every registration handed to `register`, in order. */
	registered: readonly Readonly<Record<string, KeyRegistration>>[];

	/** Switches the behaviour the next requests meet. */
	setMode(mode: FakeBridgeMode): void;

	/** Every credential `resolve` was asked for that the table does not hold. */
	unexpected: readonly (string | null)[];
}>;

/**
 * The Bridge's behaviours the fake can be switched to, its outcomes built by the Bridge's own testing
 * functions. `uncertain` attaches the open tier, the anonymous principal marked open-tier only and every
 * signed-in one suspended with a null subject; `exchangeFailed` does the same for one credential alone,
 * the Bridge being normal.
 */
export type FakeBridgeMode =
	| Readonly<{ kind: 'cold' }>
	| Readonly<{ credential: string; kind: 'exchangeFailed' }>
	| Readonly<{ kind: 'normal' }>
	| Readonly<{ kind: 'refused' }>
	| Readonly<{ kind: 'uncertain' }>;

/**
 * What the fake answers: the open tier's results, and each signed-in principal's by credential. A
 * principal's `artifactCreate` defaults to allowing every catalogue its `results` name.
 */
export type FakeBridgeTable = Readonly<{
	anonymous: Results;
	principals: Readonly<Record<string, Readonly<{ artifactCreate?: Results; results: Results; subject: string }>>>;
}>;

/**
 * Creates a fake Bridge, the suites' only stand-in for Usher, answering from a fixed, hand-written
 * `table` and refusing anything outside it. A principal it was not given is recorded in `unexpected`
 * and answered unavailable rather than thrown: the real Express layer turns a throw from `resolve` into
 * the same 503 as the cold row, so only `unexpected` tells the two apart. It implements `BridgeCore`, so
 * a fake that drifts from the real Bridge stops compiling and the Bridge's real Express layer can be
 * mounted over it.
 *
 * @param table the fixed results it answers with.
 * @param mode the behaviour it starts in; normal by default.
 */
export const createFakeBridge = (table: FakeBridgeTable, mode: FakeBridgeMode = { kind: 'normal' }): FakeBridge => {
	const state: {
		mode: FakeBridgeMode;
		registered: Readonly<Record<string, KeyRegistration>>[];
		unexpected: (string | null)[];
	} = { mode, registered: [], unexpected: [] };

	const openTier = (credential: string | null): ResolveOutcome =>
		openTierAccess(credential, withArtifactCreateAllowed(table.anonymous));

	const resolve = async (credential: string | null): Promise<ResolveOutcome> => {
		const principal =
			credential === null
				? undefined
				: Object.hasOwn(table.principals, credential)
					? table.principals[credential]
					: undefined;
		if (credential !== null && principal === undefined) {
			state.unexpected.push(credential);
			return { kind: 'unavailable' };
		}
		switch (state.mode.kind) {
			case 'cold':
				return { kind: 'unavailable' };
			case 'refused':
				return { kind: 'refused' };
			case 'uncertain':
				return openTier(credential);
			case 'exchangeFailed':
				if (credential === state.mode.credential) {
					return openTier(credential);
				}
				break;
			case 'normal':
				break;
		}
		return principal === undefined
			? anonymousAccess(withArtifactCreateAllowed(table.anonymous))
			: signedInAccess(
					principal.subject,
					principal.artifactCreate === undefined
						? withArtifactCreateAllowed(principal.results)
						: { artifactCreate: principal.artifactCreate, results: principal.results },
				);
	};

	const core: BridgeCore = {
		applyNotice: () => undefined,
		mode: () => (state.mode.kind === 'cold' ? 'cold' : state.mode.kind === 'uncertain' ? 'uncertain' : 'normal'),
		refreshAnonymous: async () => true,
		register: (registrations) => {
			state.registered.push(structuredClone(registrations));
		},
		report: () => undefined,
		reset: () => undefined,
		resolve,
		start: async () => undefined,
		// No call outlives its own promise, so nothing is in flight once a stop is called and it settles at once.
		stop: async () => undefined,
	};

	return {
		core,
		get registered() {
			return state.registered;
		},
		setMode: (next) => {
			state.mode = next;
		},
		get unexpected() {
			return state.unexpected;
		},
	};
};
