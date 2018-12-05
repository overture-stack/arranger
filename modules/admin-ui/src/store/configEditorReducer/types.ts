import { IReduxAction } from '../index';
import { IGqlData } from 'src/gql/queries/allProjectData';

export interface IProjectConfigEditorState {
  currentProjectData: IGqlData | null;
}

export enum ActionType {
  PROJECT_SELECT = 'PROJECT_SELECT',
  PROJECT_DATA_LOADED = 'PROJECT_DATA_LOADED',
  EXTENDED_MAPPING_FIELD_CHANGE = 'EXTENDED_MAPPING_FIELD_CHANGE',
  AGGS_STATE_FIELD_ORDER_CHANGE = 'AGGS_STATE_FIELD_ORDER_CHANGE',
  AGGS_STATE_FIELD_PROPERTY_CHANGE = 'AGGS_STATE_FIELD_PROPERTY_CHANGE',
  COLUMNS_STATE_FIELD_ORDER_CHANGE = 'COLUMNS_STATE_FIELD_ORDER_CHANGE',
  COLUMNS_STATE_COLUMN_PROPERTY_CHANGE = 'COLUMNS_STATE_COLUMN_PROPERTY_CHANGE',
  QUICK_SEARCH_CONFIG_PROPERTY_CHANGE = 'QUICK_SEARCH_CONFIG_PROPERTY_CHANGE',
  PROJECT_EDIT_CLEAR = 'PROJECT_EDIT_CLEAR',
}

export type TReduxAction =
  | IReduxAction<ActionType.PROJECT_DATA_LOADED, { data: IGqlData }>
  | IReduxAction<
      ActionType.EXTENDED_MAPPING_FIELD_CHANGE,
      {
        graphqlField: string;
        fieldConfig: IGqlData['project']['indices'][0]['extended'][0];
      }
    >
  | IReduxAction<
      ActionType.AGGS_STATE_FIELD_ORDER_CHANGE,
      { graphqlField: string; newIndex: number; oldIndex: number }
    >
  | IReduxAction<
      ActionType.COLUMNS_STATE_FIELD_ORDER_CHANGE,
      { graphqlField: string; newIndex: number; oldIndex: number }
    >
  | IReduxAction<
      ActionType.AGGS_STATE_FIELD_PROPERTY_CHANGE,
      {
        graphqlField: string;
        newField: IGqlData['project']['indices'][0]['aggsState']['state'][0];
      }
    >
  | IReduxAction<
      ActionType.COLUMNS_STATE_COLUMN_PROPERTY_CHANGE,
      {
        graphqlField: string;
        newField: IGqlData['project']['indices'][0]['columnsState']['state']['columns'][0];
      }
    >
  | IReduxAction<
      ActionType.QUICK_SEARCH_CONFIG_PROPERTY_CHANGE,
      {
        graphqlField: string;
        newField: IGqlData['project']['indices'][0]['matchBoxState']['state'][0];
      }
    >
  | IReduxAction<ActionType.PROJECT_EDIT_CLEAR, {}>;
