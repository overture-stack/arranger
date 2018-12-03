import * as React from 'react';
import { connect } from 'react-redux';
import { IColumnsState } from 'src/pages/VersionDashboard/AddProjectForm/types';
import { FormField } from 'mineral-ui/Form';
import Grid, { GridItem } from 'mineral-ui/Grid';
import TextInput from 'mineral-ui/TextInput';
import Component from 'react-component-component';

import { withDebouncedOnChange } from 'src/utils/';
import { ISortEventData } from '../AggsStateEditor/SortableAggsStateList';
import {
  IReduxExternalProps,
  IReduxStateProps,
  IReduxDisplatProps,
  mapStateToProps,
  mapDispatchToProps,
} from './ReduxContainer';
import SortableColumnsList from './SortableColumnsList';

interface IExternalProps extends IReduxExternalProps {}

export type TColumnWithIndex = IColumnsState['columns'][0] & {
  index: number;
};

const DebouncedInput = withDebouncedOnChange()(TextInput);
export default connect(mapStateToProps, mapDispatchToProps)(
  ({
    columnsState,
    graphqlField,
    onFieldSortChange,
  }: IExternalProps & IReduxStateProps & IReduxDisplatProps) => {
    if (!columnsState) {
      return <div>LOADING...</div>;
    }
    interface IFilterState {
      fieldFilter: string;
    }
    interface IFilterStateContainer {
      state: IFilterState;
      setState: (s: IFilterState) => void;
    }
    const { columns } = columnsState;
    const initialState: IFilterState = {
      fieldFilter: '',
    };
    const columnsWithIndex: TColumnWithIndex[] = columns.map((col, index) => ({
      ...col,
      index,
    }));
    const onSortEnd = (filteredFields: TColumnWithIndex[]) => (
      data: ISortEventData,
    ) => {
      const currentItemAtNewIndex = filteredFields[data.newIndex];
      const unfilteredNewIndex = currentItemAtNewIndex.index;
      const fieldToMove = filteredFields[data.oldIndex];
      onFieldSortChange({
        oldIndex: fieldToMove.index,
        newIndex: unfilteredNewIndex,
      });
    };
    const onFieldFilterChange = (s: IFilterStateContainer) => (
      e: React.SyntheticEvent<HTMLInputElement>,
    ) => {
      s.setState({
        ...s.state,
        fieldFilter: e.currentTarget.value,
      });
    };
    const getFilteredColumns = (s: IFilterStateContainer) =>
      columnsWithIndex.filter(c => c.field.includes(s.state.fieldFilter));
    return (
      <Component initialState={initialState}>
        {(s: IFilterStateContainer) => {
          const filteredFields = getFilteredColumns(s);
          return (
            <div>
              <Grid>
                <GridItem>
                  <FormField
                    label="Field"
                    size="small"
                    input={DebouncedInput}
                    value={s.state.fieldFilter}
                    onChange={onFieldFilterChange(s)}
                  />
                </GridItem>
              </Grid>
              <SortableColumnsList
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
