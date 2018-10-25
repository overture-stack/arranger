import { GraphQLResolveInfo } from 'graphql';
import { QueryContext } from '../';

export type ResolverOutput<T> = T | Promise<T>;

export type Resolver<Output, Args = Object> =
  | ((
      a: any,
      args: Args,
      c: QueryContext,
      d: GraphQLResolveInfo,
    ) => ResolverOutput<Output>)
  | ResolverOutput<Output>;
