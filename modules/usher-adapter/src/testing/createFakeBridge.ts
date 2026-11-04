import type { BridgeCore, KeyRegistration, ResolveOutcome } from '@overture-stack/usher-express-bridge';
import type { UsherRequestAccess } from '@overture-stack/usher-types';

import { accessOf, ANONYMOUS, signedIn, SUSPENDED } from './results.js';
import type { FakeBridge, FakeBridgeMode, FakeBridgeTable } from './types.js';

/**
 * The fake bridge, the adapter's only stand-in for Usher. It holds a fixed, hand-written table of
 * results and refuses anything outside it: a principal it was not given is recorded in `unexpected`
 * and answered unavailable, and the suites fail on any entry there, since the real Express layer
 * turns a throw from `resolve` into a 503 that would pass for the cold row. It implements `BridgeCore`,
 * so a fake that drifts from the real bridge stops compiling, and the hosts in the suites mount the
 * bridge's real Express layer over it.
 */

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
