import { type GraphQLResolveInfo } from 'graphql';

import { type SearchClient } from './searchClient/types.js';

export type Context = {
	esClient: SearchClient;
};

export type Root = Record<string, any>;

export type ResolverOutput<T> = T | Promise<T>;

/**
 * GQL resolver
 *
 * @param root - Parent object of a query.
 * @param args - Query arguments.
 * @param context - Context passed to apollo-server for queries.
 * @param info - GraphQL info object.
 * @return Returns resolved value;
 */
type DefaultRoot = Root;
export type Resolver<Root = DefaultRoot, QueryArgs = object, ReturnValue = undefined> = (
	root: Root,
	args: QueryArgs,
	context: Context,
	info: GraphQLResolveInfo,
) => ResolverOutput<ReturnValue>;
