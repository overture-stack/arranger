import { GraphQLResolveInfo } from 'graphql';
import { QueryContext } from '../types';
import { MergeInfo } from 'graphql-tools';

export type ResolverOutput<T> = T | Promise<T>;

export type Resolver<Output, Args = Object> =
  | ((
      a: any,
      args: Args,
      c: QueryContext,
      d: GraphQLResolveInfo & { mergeInfo: MergeInfo },
    ) => ResolverOutput<Output>)
  | ResolverOutput<Output>;
