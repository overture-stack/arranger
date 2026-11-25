import type { ServerAggregateStatus } from './types.js';

/**
 * The readiness answer for one probe, with the inputs that produced it. `causes` names why the server is
 * not ready, and is empty when it is. `bridgeMode` is absent when access enforcement is off, so it is
 * omitted rather than set to `undefined`.
 */
export type ReadinessObservation = {
	bridgeMode?: string;
	causes: string[];
	engineReachable: boolean;
	ready: boolean;
	status: ServerAggregateStatus;
};

/** The part of an observation a transition is judged on: the answer, and why it is not ready. */
const transitionKeyOf = ({ causes, ready }: ReadinessObservation): string => JSON.stringify({ causes, ready });

/**
 * Creates a detector that reports whether each probe's readiness differs from the one before it, so
 * `/ready` logs a transition rather than every probe.
 *
 * A change is the answer flipping, or the causes of not being ready changing while it stays not ready.
 * An input that moves without affecting either, such as the Bridge going from `normal` to `uncertain`,
 * is not a transition. The first observation always reports a change, which makes the starting state
 * visible once.
 *
 * @returns a function that takes the current observation, remembers it, and returns `true` when it
 *   differs from the previous one or there was none.
 */
export const createReadinessChangeDetector = (): ((observation: ReadinessObservation) => boolean) => {
	let previousKey: string | undefined;

	return (observation) => {
		const key = transitionKeyOf(observation);
		const changed = key !== previousKey;
		previousKey = key;
		return changed;
	};
};
