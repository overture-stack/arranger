import { Resolver } from '../types';

export interface IProjectIndexConfigs {
  'aggs-state': Array<{}>;
  'columns-state': {};
  extended: Array<{}>;
}

export interface IProjectIndexMetadata {
  index: string;
  name: string;
  esType: string;
  config: IProjectIndexConfigs;
  active: boolean;
  timestamp: string;
}

export interface IIndexGqlModel {
  id: Resolver<string>;
  hasMapping: Resolver<boolean>;
  graphqlField: Resolver<string>;
  projectId: Resolver<string>;
  esIndex: Resolver<string>;
  esType: Resolver<string>;
}

export interface IIndexQueryInput {
  projectId: string;
  graphqlField: string;
}

export interface IIndexRemovalQueryInput {
  projectId: string;
  graphqlField: string;
}

export interface INewIndexInput {
  projectId: string;
  graphqlField: string;
  esIndex: string;
  esType: string;
}
