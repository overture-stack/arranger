/** Placeholder `label` used when no catalogue identifier was provided or configured, e.g. a third-party server embedding a single catalogue with no multicatalogue context to label. */
export const FALLBACK_LABEL = 'unlabelled catalogue';

/** True when `label` is the placeholder rather than a real catalogue identifier, so callers can omit the label clause from a log line entirely instead of printing it. */
export const isFallbackLabel = (label = '') => label === FALLBACK_LABEL;

/**
 * A boot-log separator carrying the catalogue's own label, e.g. `------ donor ------`.
 * A bare `------` was fine for single-catalogue boot, where each phase of one catalogue's
 * startup ran strictly in sequence. In multicatalogue mode, several catalogues' startups
 * interleave (`Promise.allSettled` in `arrangerRoutes.ts`), so a separator with no label
 * of its own gives no clue which catalogue's section it starts until the next line is read,
 * and even then only until another catalogue's output interrupts it. Falls back to a bare
 * `------` when there's no real catalogue to label (a third-party single-catalogue embed,
 * or a boot step that happens once for the whole server rather than per catalogue).
 */
export const logSeparator = (label?: string) => (isFallbackLabel(label) ? '------' : `------ ${label} ------`);
