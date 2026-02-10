import { type GraphQLResolveInfo } from 'graphql';
import { type MergeInfo } from 'graphql-tools';

import { type IQueryContext } from '../types.js';

export type ResolverOutput<T> = T | Promise<T>;

export interface EsIndexLocation {
	esIndex: string;
}

export type Resolver<Output, Args = object> =
	| ((
			a: any,
			args: Args,
			c: IQueryContext,
			d: GraphQLResolveInfo & { mergeInfo: MergeInfo },
	  ) => ResolverOutput<Output>)
	| ResolverOutput<Output>;
