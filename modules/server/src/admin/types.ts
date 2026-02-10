import { type GraphQLResolveInfo } from 'graphql';
import { type MergeInfo } from 'graphql-tools';

import { type AllClients } from '../searchClient/index.js';

export type AdminApiConfig = {
	esHost: string;
	esUser: string;
	esPass: string;
};
export type IQueryContext = {
	es: AllClients;
};

export type ResolverOutput<T> = T | Promise<T>;

export type MergeResolver<Output, Args = object> =
	| ((
			a: any,
			args: Args,
			c: IQueryContext,
			d: GraphQLResolveInfo & { mergeInfo: MergeInfo },
	  ) => ResolverOutput<Output>)
	| ResolverOutput<Output>;

export type I_MergeSchema<TOutput, TInput = any> = {
	fragment: string;
	resolve: MergeResolver<TOutput, TInput>;
};
