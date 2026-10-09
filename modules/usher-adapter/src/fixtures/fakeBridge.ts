import type { BridgeCore, KeyRegistration, ResolveOutcome } from '@overture-stack/usher-express-bridge';
import type { Enforcement, UsherRequestAccess } from '@overture-stack/usher-types';

import { accessOf, ANONYMOUS, signedIn, SUSPENDED } from './results.js';

/**
 * The fake bridge, the adapter's only stand-in for Usher. It holds a fixed, hand-written table of
 * results and refuses anything outside it: a principal it was not given is recorded in `unexpected`
 * and answered unavailable, and the suites fail on any entry there, since the real Express layer
 * turns a throw from `resolve` into a 503 that would pass for the cold row. It implements `BridgeCore`,
 * so a fake that drifts from the real bridge stops compiling, and the hosts in the suites mount the
 * bridge's real Express layer over it.
 */

type Results = Readonly<Record<string, Enforcement>>;

/** What the fake answers: the open tier's results, and each signed-in principal's by credential. */
export type FakeBridgeTable = Readonly<{
	anonymous: Results;
	principals: Readonly<Record<string, Readonly<{ results: Results; subject: string }>>>;
}>;

/**
 * The bridge's own behaviours the fake reproduces. `uncertain` attaches the open tier, the anonymous
 * principal marked open-tier only and every signed-in one suspended with a null subject;
 * `exchangeFailed` does the same for one credential alone, the bridge being normal.
 */
export type FakeBridgeMode =
	| Readonly<{ kind: 'cold' }>
	| Readonly<{ credential: string; kind: 'exchangeFailed' }>
	| Readonly<{ kind: 'normal' }>
	| Readonly<{ kind: 'refused' }>
	| Readonly<{ kind: 'uncertain' }>;

/** The fake, with what it recorded. */
export type FakeBridge = Readonly<{
	core: BridgeCore;

	/** Every registration handed to `register`, in order. */
	registered: readonly Readonly<Record<string, KeyRegistration>>[];

	/** Switches the behaviour the next requests meet. */
	setMode(mode: FakeBridgeMode): void;

	/** Every credential `resolve` was asked for that the table does not hold. */
	unexpected: readonly (string | null)[];
}>;

const answered = (access: UsherRequestAccess): ResolveOutcome => ({ access, kind: 'access' });

/**
 * Creates a fake bridge answering from `table`.
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
		answered(accessOf(credential === null ? ANONYMOUS : SUSPENDED, table.anonymous));

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
			? answered(accessOf(ANONYMOUS, table.anonymous))
			: answered(accessOf(signedIn(principal.subject), principal.results));
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
		stop: () => undefined,
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
