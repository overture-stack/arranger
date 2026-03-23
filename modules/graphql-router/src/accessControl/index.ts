import type { ConfigsObject } from '@overture-stack/arranger-types/configs';
import { configOptionalProperties } from '@overture-stack/arranger-types/configs/constants';
import type { RequestHandler } from 'express';

import rejectSqonWhenFiltersDisabled from './disableFilters.js';

type AccessControlFactory = (args: { configs: Partial<ConfigsObject> }) => RequestHandler | null;

const composeMiddlewares = (middlewares: RequestHandler[]): RequestHandler => {
	return (req, res, next) => {
		const run = (index: number, err?: unknown): void => {
			if (err) {
				next(err);
				return;
			}

			const middleware = middlewares[index];

			if (!middleware) {
				next();
				return;
			}

			middleware(req, res, (nextErr?: unknown) => run(index + 1, nextErr));
		};

		run(0);
	};
};

const accessControlFactories: AccessControlFactory[] = [
	({ configs }) => (configs[configOptionalProperties.DISABLE_FILTERS] ? rejectSqonWhenFiltersDisabled() : null),
];

const enforceAccessControl = ({ configs }: { configs: Partial<ConfigsObject> }): RequestHandler => {
	const enabledMiddlewares = accessControlFactories
		.map((createAccessControl) => createAccessControl({ configs }))
		.filter((middleware): middleware is RequestHandler => middleware !== null);

	return composeMiddlewares(enabledMiddlewares);
};

export default enforceAccessControl;
export { default as getDefaultServerSideFilter } from './getDefaultServerSideFilter.js';
