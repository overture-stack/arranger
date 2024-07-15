import { mergeTypeDefs } from '@graphql-tools/merge';
import { RemoteConnectionNode } from './remoteConnections';

export const typeDefs = mergeTypeDefs([RemoteConnectionNode]);
