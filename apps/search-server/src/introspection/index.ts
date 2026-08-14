import { Router, type Router as ExpressRouter } from 'express';

import type { CatalogueStatusDetail } from '#availability/index.js';
import findCatalogueByIdentifier from '#catalogues/findCatalogueByIdentifier.js';
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

	// Dispatch to the catalogue's own router, which owns the live field data. `:catalogueId`
	// accepts either the real catalogue id or, when it names exactly one catalogue, its
	// documentType; see findCatalogueByIdentifier for the resolution and ambiguity rules.
	router.get('/introspection/:catalogueId', (req, res, next) => {
		const match = findCatalogueByIdentifier({ catalogs, identifier: req.params.catalogueId });

		if (match.outcome === 'ambiguous') {
			return res.status(409).json({
				documentType: req.params.catalogueId,
				error: {
					code: 'ambiguous_document_type',
					message: `documentType "${req.params.catalogueId}" matches multiple catalogues; use the catalogue id instead.`,
				},
				matchingCatalogueIds: match.matchingCatalogueIds,
			});
		}

		const catalogueRouter = match.outcome === 'matched' ? catalogueRouters[match.catalogueId] : undefined;
		if (!catalogueRouter) {
			return res.status(404).json({ error: `Catalogue "${req.params.catalogueId}" was not found.` });
		}
		req.url = '/introspection';
		return catalogueRouter(req, res, next);
	});

	return router;
};

export default createIntrospectionRoutes;
