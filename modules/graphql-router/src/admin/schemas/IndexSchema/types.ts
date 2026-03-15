import { Resolver } from '../types';
import { I_GqlExtendedFieldMapping } from '../ExtendedMapping/types';
import { I_ColumnSetState } from '../ColumnsState/types';
import { I_AggsSetState } from '../AggsState/types';
import { I_MatchBoxState } from '../MatchboxState/types';

export interface IProjectIndexConfigs {
  'aggs-state': I_AggsSetState;
  'columns-state': I_ColumnSetState;
  'matchbox-state': I_MatchBoxState;
  extended: I_GqlExtendedFieldMapping[];
}

export interface IProjectIndexMetadata {
  index: string;
  name: string;
  config: IProjectIndexConfigs;
  active: boolean;
  timestamp: string;
}

export interface I_ProjectIndexConfigsUpdateDoc {
  'aggs-state'?: I_AggsSetState;
  'columns-state'?: I_ColumnSetState;
  'matchbox-state'?: I_MatchBoxState;
  extended?: I_GqlExtendedFieldMapping[];
}

export interface I_ProjectIndexMetadataUpdateDoc {
  index: string;
  name: string;
  // esType?: string;
  config?: I_ProjectIndexConfigsUpdateDoc;
  active?: boolean;
  // timestamp?: string;
}

export interface IIndexGqlModel {
  id: Resolver<string>;
  hasMapping: Resolver<boolean>;
  graphqlField: Resolver<string>;
  projectId: Resolver<string>;
  esIndex: Resolver<string>;
}

export interface IIndexQueryInput {
  projectId: string;
  graphqlField: string;
}

export interface IIndexRemovalMutationInput {
  projectId: string;
  graphqlField: string;
}

export interface INewIndexInput {
  projectId: string;
  graphqlField: string;
  esIndex: string;
}
