import type { RequestHandler } from 'express';

export const addContext = (patch: Record<PropertyKey, unknown>): RequestHandler => {
	return (req, _res, next) => {
		req.context = { ...req.context, ...patch };
		next();
	};
};
