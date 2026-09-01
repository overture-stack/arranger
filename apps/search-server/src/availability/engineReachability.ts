import { type SearchClient } from '@overture-stack/arranger-graphql-router';

/**
 * A running reachability probe, returned by {@link startEngineProbe}.
 *
 * `isReachable` reports whether the most recent probe reached the engine, and is optimistic until
 * the first one completes. `stop` halts further probing and is safe to call more than once.
 */
export type EngineProbe = {
	isReachable: () => boolean;
	stop: () => void;
};

/**
 * Polls the search engine so readiness reflects the engine's current state rather than its state at
 * startup.
 *
 * Catalogue statuses are decided once, while routers are built. Without this probe an engine that
 * dies after boot keeps `/ready` at 200, and one that recovers after a failed boot keeps it at 503
 * until the pod restarts.
 *
 * `indices.exists` needs no cluster-level permission, so the application credential stays as narrow
 * as it is. A 404 or a 403 both prove the engine answered; only a transport failure means
 * unreachable.
 *
 * @param esClient when absent, the probe is inert and reports reachable, leaving readiness exactly
 *   as it was.
 * @param index an index to address the probe at. Its existence does not matter, only that the engine
 *   answers.
 * @param intervalMs how often to re-probe, from `PING_MS`.
 * @returns a handle for reading the latest result and stopping the probe.
 */
export const startEngineProbe = ({
	esClient,
	index,
	intervalMs,
}: {
	esClient?: SearchClient;
	index: string;
	intervalMs: number;
}): EngineProbe => {
	if (!esClient) {
		return { isReachable: () => true, stop: () => {} };
	}

	let reachable = true;

	const probe = async () => {
		try {
			await esClient.indices.exists({ index });
			reachable || console.log('  Search engine is reachable again.');
			reachable = true;
		} catch (err) {
			reachable &&
				console.error(`  Search engine is unreachable: ${err instanceof Error ? err.message : err}`);
			reachable = false;
		}
	};

	const timer = setInterval(() => void probe(), intervalMs);
	// `unref` so a pending probe never holds the process open during shutdown.
	timer.unref?.();

	void probe();

	return {
		isReachable: () => reachable,
		stop: () => clearInterval(timer),
	};
};
