import { Router, type Router as ExpressRouter } from 'express';

import type { CatalogsMap } from '#configs/types/index.js';
import buildServerDetails from '#introspection/serverDetails.js';
import buildSqonDetails from '#introspection/sqonDetails.js';

const createIntrospectionRoutes = ({
	catalogs,
	catalogueRouters,
}: {
	catalogs: CatalogsMap;
	catalogueRouters: Record<string, ExpressRouter>;
}) => {
	const router = Router();
	const catalogIds = Object.keys(catalogs);
	const onlyCatalogId = catalogIds.length === 1 ? catalogIds[0] : undefined;

	router.get('/introspection', (_req, res) => {
		res.json(buildServerDetails({ catalogs }));
	});

	router.get('/introspection/sqon', (_req, res) => {
		res.json(buildSqonDetails());
	});

	// In single-catalogue mode, /introspection/fields is an alias for the catalogue endpoint.
	router.get('/introspection/fields', (req, res, next) => {
		if (!onlyCatalogId) return next();
		const catalogueRouter = catalogueRouters[onlyCatalogId];
		if (!catalogueRouter) return next();
		req.url = '/introspection';
		return catalogueRouter(req, res, next);
	});

	// Dispatch to the catalogue's own router, which owns the live field data.
	router.get('/introspection/:catalogId', (req, res, next) => {
		const catalogueRouter = catalogueRouters[req.params.catalogId];
		if (!catalogueRouter) {
			return res.status(404).json({ error: `Catalog "${req.params.catalogId}" was not found.` });
		}
		req.url = '/introspection';
		return catalogueRouter(req, res, next);
	});

	return router;
};

export default createIntrospectionRoutes;
