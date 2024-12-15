import { Client } from '@elastic/elasticsearch';
import { GraphQLResolveInfo } from 'graphql';

export type Context = {
	esClient: Client;
};

export type Resolver<Root, QueryArgs, ReturnValue> = (
	root: Root,
	args: QueryArgs,
	context: Context,
	info: GraphQLResolveInfo,
) => ReturnValue;
