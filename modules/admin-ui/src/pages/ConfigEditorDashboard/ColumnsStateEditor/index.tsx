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

type ColumnConfig = IColumnsState['columns'][0];

export type TColumnWithIndex = ColumnConfig & {
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
      return <div>LOADING... | null </div>;
    }
    interface IFilterState {
      fieldFilter: string;
      show: string | null;
      sortable: string | null;
    }
    interface ICustomColumnConfig extends ColumnConfig {}
    interface IFilterStateContainer {
      state: { filter: IFilterState; customColumn: ICustomColumnConfig };
      setState: (s: IFilterStateContainer['state']) => void;
    }
    const { columns } = columnsState;

    /* TODO: implement adding custom columns */
    const emptyCustomColumn: ICustomColumnConfig = {
      field: '',
      canChangeShow: false,
      show: false,
      sortable: false,
      accessor: '',
      jsonPath: '',
      query: '',
      type: '',
      id: null,
    };
    const initialState: IFilterStateContainer['state'] = {
      filter: { fieldFilter: '', show: null, sortable: null },
      customColumn: emptyCustomColumn,
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
        filter: {
          ...s.state.filter,
          fieldFilter: e.currentTarget.value,
        },
      });
    };
    const onColumnShowFilterSelect = (s: IFilterStateContainer) => (
      o: ISelectOption,
    ) => {
      s.setState({
        ...s.state,
        filter: {
          ...s.state.filter,
          show: o.value,
        },
      });
    };
    const onColumnSortableFilterSelect = (s: IFilterStateContainer) => (
      o: ISelectOption,
    ) => {
      s.setState({
        ...s.state,
        filter: {
          ...s.state.filter,
          sortable: o.value,
        },
      });
    };
    const getFilteredColumns = (s: IFilterStateContainer) =>
      columnsWithIndex.filter(
        c =>
          c.field.includes(s.state.filter.fieldFilter) &&
          (s.state.filter.show !== null
            ? String(c.show) === s.state.filter.show
            : true) &&
          (s.state.filter.sortable !== null
            ? String(c.sortable) === s.state.filter.sortable
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
                    value={s.state.filter.fieldFilter}
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
                      text: s.state.filter.show || '',
                      value: s.state.filter.show,
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
                      text: s.state.filter.sortable || '',
                      value: s.state.filter.sortable,
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
