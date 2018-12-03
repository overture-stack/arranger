import * as React from 'react';
import { connect } from 'react-redux';
import { IColumnsState } from 'src/pages/VersionDashboard/AddProjectForm/types';
import { FormField } from 'mineral-ui/Form';
import Grid, { GridItem } from 'mineral-ui/Grid';
import Select from 'mineral-ui/Select';
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
import { booleanFilterOptions } from 'src/pages/ConfigEditorDashboard/AggsStateEditor';
import { ISelectOption } from '../ExtendedMappingEditor/FieldsFilterDisplay';

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
      show: string | null;
      sortable: string | null;
    }
    interface IFilterStateContainer {
      state: IFilterState;
      setState: (s: IFilterState) => void;
    }
    const { columns } = columnsState;
    const initialState: IFilterState = {
      fieldFilter: '',
      show: null,
      sortable: null,
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
    const onColumnShowFilterSelect = (s: IFilterStateContainer) => (
      o: ISelectOption,
    ) => {
      s.setState({
        ...s.state,
        show: o.value,
      });
    };
    const onColumnSortableFilterSelect = (s: IFilterStateContainer) => (
      o: ISelectOption,
    ) => {
      s.setState({
        ...s.state,
        sortable: o.value,
      });
    };
    const getFilteredColumns = (s: IFilterStateContainer) =>
      columnsWithIndex.filter(
        c =>
          c.field.includes(s.state.fieldFilter) &&
          (s.state.show !== null ? String(c.show) === s.state.show : true) &&
          (s.state.sortable !== null
            ? String(c.sortable) === s.state.sortable
            : true),
      );
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
                <GridItem>
                  <FormField
                    label="Shown"
                    size="small"
                    input={Select}
                    data={booleanFilterOptions}
                    onChange={onColumnShowFilterSelect(s)}
                    selectedItem={{
                      text: s.state.show || '',
                      value: s.state.show,
                    }}
                  />
                </GridItem>
                <GridItem>
                  <FormField
                    label="Sortable"
                    size="small"
                    input={Select}
                    data={booleanFilterOptions}
                    onChange={onColumnSortableFilterSelect(s)}
                    selectedItem={{
                      text: s.state.sortable || '',
                      value: s.state.sortable,
                    }}
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
