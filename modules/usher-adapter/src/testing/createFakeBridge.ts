import type { BridgeCore, KeyRegistration, ResolveOutcome } from '@overture-stack/usher-express-bridge';
import type { UsherRequestAccess } from '@overture-stack/usher-types';

import { accessOf, ANONYMOUS, signedIn, SUSPENDED } from './results.js';
import type { FakeBridge, FakeBridgeMode, FakeBridgeTable } from './types.js';

const answered = (access: UsherRequestAccess): ResolveOutcome => ({ access, kind: 'access' });

/**
 * Creates a fake bridge, the suites' only stand-in for Usher, answering from a fixed, hand-written
 * `table` and refusing anything outside it. A principal it was not given is recorded in `unexpected`
 * and answered unavailable rather than thrown: the real Express layer turns a throw from `resolve` into
 * the same 503 as the cold row, so only `unexpected` tells the two apart. It implements `BridgeCore`, so
 * a fake that drifts from the real bridge stops compiling and the bridge's real Express layer can be
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
