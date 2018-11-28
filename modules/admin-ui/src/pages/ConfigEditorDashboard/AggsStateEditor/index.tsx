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

/***************
 * main component
 ***************/
interface IExternalProps {
  graphqlField: string;
}

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
