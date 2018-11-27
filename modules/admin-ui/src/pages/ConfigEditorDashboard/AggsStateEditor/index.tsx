import * as React from 'react';
import { connect } from 'react-redux';
import Component from 'react-component-component';
import { IGlobalState } from 'src/store';
import { FormField } from 'mineral-ui/Form';
import TextInput from 'mineral-ui/TextInput';
import Select from 'mineral-ui/Select';
import Grid, { GridItem } from 'mineral-ui/Grid';

import { withDebouncedOnChange } from 'src/utils/';
import { IAggsState } from 'src/pages/VersionDashboard/AddProjectForm/types';

import SortableAggsStateList, {
  IAggsStateEntryWithIndex,
  ISortEventData,
} from './SortableAggsStateList';
import { ActionType, TReduxAction } from 'src/store/configEditorReducer';
import { Dispatch } from 'redux';

/***************
 * main component
 ***************/
interface IExternalProps {
  graphqlField: string;
}
export interface IReduxStateProps {
  aggsState?: IAggsState;
}
export interface IReduxDispatchProps {
  onFieldSortChange: (
    field: IAggsStateEntryWithIndex,
    newIndex: number,
  ) => void;
}

const DebouncedInput = withDebouncedOnChange()(TextInput);
export const mapStateToProps = (
  state: IGlobalState,
  { graphqlField }: IExternalProps,
): IReduxStateProps => {
  console.log('yoooooo!!!!!!');
  if (!state.configEditor.currentProjectData) {
    return {};
  } else {
    const currentProjectIndexData = state.configEditor.currentProjectData.project.indices.find(
      index => index.graphqlField === graphqlField,
    );
    if (currentProjectIndexData) {
      return {
        aggsState: currentProjectIndexData.aggsState.state,
      };
    } else {
      return {};
    }
  }
};
export const mapDispatchToProps = (
  dispatch: Dispatch<TReduxAction>,
  state: IExternalProps,
): IReduxDispatchProps => ({
  onFieldSortChange: (field: IAggsStateEntryWithIndex, newIndex: number) => {
    dispatch({
      type: ActionType.AGGS_STATE_FIELD_ORDER_CHANGE,
      payload: {
        graphqlField: state.graphqlField,
        oldIndex: field.index,
        newIndex,
      },
    });
  },
});
export default connect(mapStateToProps, mapDispatchToProps)(
  ({
    aggsState,
    graphqlField,
    onFieldSortChange,
  }: IExternalProps & IReduxStateProps & IReduxDispatchProps) => {
    if (!aggsState) {
      return <div>LOADING...</div>;
    }

    interface ILocalState {
      fieldFilter: string;
    }

    interface IStateContainer {
      state: ILocalState;
      setState: (s: ILocalState) => void;
    }

    const initialState: ILocalState = {
      fieldFilter: '',
    };

    const onFieldFilterChange = (s: IStateContainer) => (
      e: React.SyntheticEvent<HTMLInputElement>,
    ) =>
      s.setState({
        fieldFilter: e.currentTarget.value,
      });

    const aggsStateWithIndex: Array<IAggsStateEntryWithIndex> = aggsState.map(
      (s, i) => ({
        ...s,
        index: i,
      }),
    );

    const getFilteredFields = (s: IStateContainer) => {
      return aggsStateWithIndex.filter(i =>
        i.field.includes(s.state.fieldFilter),
      );
    };

    const onSortEnd = (filteredFields: IAggsStateEntryWithIndex[]) => (
      data: ISortEventData,
    ) => {
      const currentItemAtNewIndex = filteredFields[data.newIndex];
      const unfilteredNewIndex = currentItemAtNewIndex.index;
      const fieldtoMove = filteredFields[data.oldIndex];
      onFieldSortChange(fieldtoMove, unfilteredNewIndex);
    };

    return (
      <Component initialState={initialState}>
        {(s: IStateContainer) => {
          const filteredFields = getFilteredFields(s);
          return (
            <div>
              <Grid>
                <GridItem>
                  <FormField
                    label="Field filter"
                    size="small"
                    input={DebouncedInput}
                    value={s.state.fieldFilter}
                    onChange={onFieldFilterChange(s)}
                  />
                </GridItem>
                <GridItem>
                  <FormField
                    input={Select}
                    label="Active"
                    size="small"
                    data={[]}
                  />
                </GridItem>
                <GridItem>
                  <FormField
                    input={Select}
                    label="Show"
                    size="small"
                    data={[]}
                  />
                </GridItem>
              </Grid>
              <SortableAggsStateList
                graphqlField={graphqlField}
                items={filteredFields}
                useDragHandle={true}
                onSortEnd={onSortEnd(filteredFields)}
              />
            </div>
          );
        }}
      </Component>
    );
  },
);
