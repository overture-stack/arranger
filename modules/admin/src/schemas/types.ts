import { GraphQLResolveInfo } from 'graphql';
import { IQueryContext } from '../types';
import { MergeInfo } from 'graphql-tools';

export type ResolverOutput<T> = T | Promise<T>;

export interface EsIndexLocation {
  esIndex: string;
}

export type Resolver<Output, Args = Object> =
  | ((
      a: any,
      args: Args,
      c: IQueryContext,
      d: GraphQLResolveInfo & { mergeInfo: MergeInfo },
    ) => ResolverOutput<Output>)
  | ResolverOutput<Output>;
