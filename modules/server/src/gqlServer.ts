import { Client } from '@elastic/elasticsearch';
import { GraphQLResolveInfo } from 'graphql';

export type Context = {
	esClient: Client;
};

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
export type Resolver<Root = {}, QueryArgs = Object, ReturnValue = undefined> = (
	root: Root,
	args: QueryArgs,
	context: Context,
	info: GraphQLResolveInfo,
) => ResolverOutput<ReturnValue> | ResolverOutput<ReturnValue>;
