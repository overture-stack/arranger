import type { RequestHandler } from 'express';

/**
 * Refuses every request to `/download` when a deployment has turned downloads off.
 *
 * Mounted in place of the real routes, so the streaming handler is unreachable rather than one early
 * return away from serving.
 *
 * **404, not 403.** The deployment does not offer the endpoint. 403 stays reserved for a caller
 * refused on their own authority, which is what access control will need once downloads can be
 * permitted per principal; using it here would merge the two cases.
 *
 * @returns a handler answering every method and path beneath the mount.
 */
export const refuseDisabledDownloads = (): RequestHandler => (_req, res) => {
	res.status(404).json({ error: 'Downloads are disabled for this server.' });
};

export default refuseDisabledDownloads;
