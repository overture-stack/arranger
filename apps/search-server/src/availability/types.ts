import type { CatalogueErrorDetail } from '@overture-stack/arranger-graphql-router';

/** Per-catalogue availability. `disabled` and `loading` are reserved for future work (operator-disable, reload) and are not produced by this module yet. */
export const catalogueStatuses = {
	AVAILABLE: 'available',
	FAILED: 'failed',
} as const;

export type CatalogueStatus = (typeof catalogueStatuses)[keyof typeof catalogueStatuses];

/** A catalogue's status plus, only when `failed`, the error detail explaining why; omitted entirely rather than set to `null` when `available`. */
export type CatalogueStatusDetail =
	| { status: typeof catalogueStatuses.AVAILABLE }
	| { status: typeof catalogueStatuses.FAILED; error: CatalogueErrorDetail };

/** Server-wide aggregate over enabled catalogues, intended for a readiness probe; carries no failure explanation of its own, that stays a catalogue-level concern. */
export const serverAggregateStatuses = {
	DEGRADED: 'degraded',
	HEALTHY: 'healthy',
	UNHEALTHY: 'unhealthy',
} as const;

export type ServerAggregateStatus = (typeof serverAggregateStatuses)[keyof typeof serverAggregateStatuses];
