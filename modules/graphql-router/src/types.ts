import { type GraphQLResolveInfo } from 'graphql';
import type { IMiddleware, IMiddlewareGenerator } from 'graphql-middleware';

import type { SearchClient } from './searchClient/types.js';

export type Root = Record<string, any>;

export type ResolverOutput<T> = T | Promise<T>;

type DefaultRoot = Root;

/**
 * GQL resolver
 *
 * @param root - Parent object of a query.
 * @param args - Query arguments.
 * @param context - Context passed to apollo-server for queries.
 * @param info - GraphQL info object.
 * @return Returns resolved value;
 */
export type Resolver<
	Root = DefaultRoot,
	QueryArgs = object,
	ReturnValue = undefined,
	Context extends ArrangerBaseContext = ArrangerBaseContext,
> = (root: Root, args: QueryArgs, context: Context, info: GraphQLResolveInfo) => ResolverOutput<ReturnValue>;

export type ArrangerBaseContext = {
	esClient: SearchClient;
};
export type GraphQLEndpointMiddleware<TSource = any, TContext = any, TArgs = any> =
	| IMiddleware<TSource, TContext, TArgs>
	| IMiddlewareGenerator<TSource, TContext, TArgs>;

export type GraphQLEndpointOptions<Context extends ArrangerBaseContext> = {
	context?: Context | ((req: Request, res: Response, connection: any) => Context);
	middleware?: GraphQLEndpointMiddleware[];
} & Record<string, unknown>;
