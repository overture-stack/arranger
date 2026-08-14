import {
	type CatalogueStatusDetail,
	catalogueStatuses,
	type ServerAggregateStatus,
	serverAggregateStatuses,
} from './types.js';

/**
 * Computes the server-wide aggregate over per-catalogue statuses, intended for a readiness
 * probe. `disabled` catalogues are not yet modelled by this codebase, so every catalogue passed
 * in is treated as enabled; once operator-disable exists, disabled entries should be filtered
 * out before calling this.
 */
export const computeAggregateServerStatus = (statuses: Record<string, CatalogueStatusDetail>): ServerAggregateStatus => {
	const values = Object.values(statuses);
	const availableCount = values.filter((detail) => detail.status === catalogueStatuses.AVAILABLE).length;
	const failedCount = values.filter((detail) => detail.status === catalogueStatuses.FAILED).length;

	if (failedCount === 0) {
		return serverAggregateStatuses.HEALTHY;
	}

	return availableCount === 0 ? serverAggregateStatuses.UNHEALTHY : serverAggregateStatuses.DEGRADED;
};
