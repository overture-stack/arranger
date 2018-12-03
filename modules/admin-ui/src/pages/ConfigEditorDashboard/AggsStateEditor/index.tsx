import * as React from 'react';
import { connect } from 'react-redux';
import Component from 'react-component-component';
import { FormField } from 'mineral-ui/Form';
import TextInput from 'mineral-ui/TextInput';
import Select from 'mineral-ui/Select';
import Grid, { GridItem } from 'mineral-ui/Grid';

import { withDebouncedOnChange } from 'src/utils/';

import SortableAggsStateList, { ISortEventData } from './SortableAggsStateList';
import {
  mapStateToProps,
  mapDispatchToProps,
  IReduxStateProps,
  IReduxDispatchProps,
  IAggsStateEntryWithIndex,
} from './ReduxContainer';
import {
  BOOLEAN_FILTER_VALUES,
  ISelectOption,
} from '../ExtendedMappingEditor/FieldsFilterDisplay';

/***************
 * main component
 ***************/
interface IExternalProps {
  graphqlField: string;
}

export const booleanFilterOptions = [
  { text: 'none', value: null },
  ...Object.values(BOOLEAN_FILTER_VALUES).map(val => ({
    text: val,
    value: val,
  })),
];

const DebouncedInput = withDebouncedOnChange()(TextInput);
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
      active: string | null;
      show: string | null;
    }
    interface IStateContainer {
      state: ILocalState;
      setState: (s: ILocalState) => void;
    }
    const initialState: ILocalState = {
      fieldFilter: '',
      active: null,
      show: null,
    };
    const onFieldFilterChange = (s: IStateContainer) => (
      e: React.SyntheticEvent<HTMLInputElement>,
    ) =>
      s.setState({
        ...s.state,
        fieldFilter: e.currentTarget.value,
      });
    const aggsStateWithIndex: Array<IAggsStateEntryWithIndex> = aggsState.map(
      (s, i) => ({
        ...s,
        index: i,
      }),
    );
    const getFilteredFields = (s: IStateContainer) =>
      aggsStateWithIndex.filter(
        i =>
          i.field.includes(s.state.fieldFilter) &&
          (s.state.active !== null
            ? String(i.active) === s.state.active
            : true) &&
          (s.state.show !== null ? String(i.show) === s.state.show : true),
      );
    const onSortEnd = (filteredFields: IAggsStateEntryWithIndex[]) => (
      data: ISortEventData,
    ) => {
      const currentItemAtNewIndex = filteredFields[data.newIndex];
      const unfilteredNewIndex = currentItemAtNewIndex.index;
      const fieldtoMove = filteredFields[data.oldIndex];
      onFieldSortChange(fieldtoMove, unfilteredNewIndex);
    };
    const onFieldActiveFilterChange = (s: IStateContainer) => ({
      value,
    }: ISelectOption) =>
      s.setState({
        ...s.state,
        active: value,
      });
    const onFieldShowFilterChange = (s: IStateContainer) => ({
      value,
    }: ISelectOption) =>
      s.setState({
        ...s.state,
        show: value,
      });
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
                    data={booleanFilterOptions}
                    selectedItem={{
                      text: s.state.active || '',
                      value: s.state.active,
                    }}
                    onChange={onFieldActiveFilterChange(s)}
                  />
                </GridItem>
                <GridItem>
                  <FormField
                    input={Select}
                    label="Show"
                    size="small"
                    data={booleanFilterOptions}
                    selectedItem={{
                      text: s.state.show || '',
                      value: s.state.show,
                    }}
                    onChange={onFieldShowFilterChange(s)}
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
