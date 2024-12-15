import { Client } from '@elastic/elasticsearch';
import { GraphQLResolveInfo } from 'graphql';

export type Context = {
	esClient: Client;
};

export type ResolverOutput<T> = T | Promise<T>;

/**
 * GQL resolver
 *
 * @param root The parent object of a query.
 * @param args The query arguments.
 * @param context The context passed to apollo-server for queries.
 * @param info The GraphQL info object.
 * @return Returns resolved value;
 */
export type Resolver<Root = {}, QueryArgs = Object, ReturnValue = undefined> = (
	root: Root,
	args: QueryArgs,
	context: Context,
	info: GraphQLResolveInfo,
) => ResolverOutput<ReturnValue> | ResolverOutput<ReturnValue>;
