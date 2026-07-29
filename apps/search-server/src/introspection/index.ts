import { Router, type Router as ExpressRouter } from 'express';

import type { CatalogueStatusDetail } from '#availability/index.js';
import type { CataloguesMap } from '#configs/types/index.js';
import buildServerDetails from '#introspection/serverDetails.js';
import buildSqonDetails from '#introspection/sqonDetails.js';

const createIntrospectionRoutes = ({
	catalogs,
	catalogueRouters,
	catalogueStatuses,
}: {
	catalogs: CataloguesMap;
	catalogueRouters: Record<string, ExpressRouter>;
	catalogueStatuses: Record<string, CatalogueStatusDetail>;
}) => {
	const router = Router();
	const catalogueIds = Object.keys(catalogs);
	const onlyCatalogueId = catalogueIds.length === 1 ? catalogueIds[0] : undefined;

	router.get('/introspection', (_req, res) => {
		res.json(buildServerDetails({ catalogs, catalogueStatuses }));
	});

	router.get('/introspection/sqon', (_req, res) => {
		res.json(buildSqonDetails());
	});

	// In single-catalogue mode, /introspection/fields is an alias for the catalogue endpoint.
	router.get('/introspection/fields', (req, res, next) => {
		if (!onlyCatalogueId) {
			return next();
		}

		const catalogueRouter = catalogueRouters[onlyCatalogueId];

		if (!catalogueRouter) {
			return next();
		}

		req.url = '/introspection';
		return catalogueRouter(req, res, next);
	});

	// Dispatch to the catalogue's own router, which owns the live field data.
	router.get('/introspection/:catalogueId', (req, res, next) => {
		const catalogueRouter = catalogueRouters[req.params.catalogueId];
		if (!catalogueRouter) {
			return res.status(404).json({ error: `Catalogue "${req.params.catalogueId}" was not found.` });
		}
		req.url = '/introspection';
		return catalogueRouter(req, res, next);
	});

	return router;
};

export default createIntrospectionRoutes;
