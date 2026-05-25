import { Router } from 'express';
import type { Response } from 'express';

import type { CatalogsMap } from '#configs/types/index.js';
import buildCatalogDetails from '#introspection/catalogDetails.js';
import buildServerDetails from '#introspection/serverDetails.js';
import buildSqonDetails from '#introspection/sqonDetails.js';

const createIntrospectionRoutes = ({ catalogs }: { catalogs: CatalogsMap }) => {
	const router = Router();
	const generatedAt = new Date().toISOString();
	const catalogIds = Object.keys(catalogs);
	const onlyCatalogId = catalogIds.length === 1 ? catalogIds[0] : undefined;
	const sendCatalogDetails = ({ catalogId, res }: { catalogId: string; res: Response }) => {
		const details = buildCatalogDetails({
			catalogId,
			catalogs,
			generatedAt,
		});

		if (!details) {
			return res.status(404).json({
				error: `Catalog "${catalogId}" was not found.`,
			});
		}

		return res.json(details);
	};

	router.get('/introspection', (_req, res) => {
		res.json(buildServerDetails({ catalogs }));
	});

	router.get('/introspection/sqon', (_req, res) => {
		res.json(buildSqonDetails());
	});

	router.get('/introspection/fields', (_req, res, next) => {
		if (!onlyCatalogId) {
			return next();
		}

		return sendCatalogDetails({
			catalogId: onlyCatalogId,
			res,
		});
	});

	router.get('/introspection/:catalogId', (req, res) => {
		return sendCatalogDetails({
			catalogId: req.params.catalogId,
			res,
		});
	});

	return router;
};

export default createIntrospectionRoutes;
