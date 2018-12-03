import * as React from 'react';
import { connect } from 'react-redux';
import { IGlobalState } from 'src/store';
import {
  viewProjectIndex,
  TReduxAction,
  ActionType,
} from 'src/store/configEditorReducer';
import { IColumnsState } from 'src/pages/VersionDashboard/AddProjectForm/types';
import { FormField } from 'mineral-ui/Form';
import Select from 'mineral-ui/Select';
import Card, { CardTitle } from 'mineral-ui/Card';
import Grid, { GridItem } from 'mineral-ui/Grid';
import TextInput from 'mineral-ui/TextInput';
import Text from 'mineral-ui/Text';
import Checkbox from 'mineral-ui/Checkbox';
import { range, isEqual } from 'lodash';
import { SortableContainer, SortableElement } from 'react-sortable-hoc';
import { compose } from 'recompose';
import Component from 'react-component-component';
import { curry, __ } from 'ramda'; //doc: https://ramdajs.com/docs/#curry

import { withDebouncedOnChange } from 'src/utils/';
import { DragHandle } from '../SortableList';
import { ISelectOption } from '../ExtendedMappingEditor/FieldsFilterDisplay';
import { Dispatch } from 'redux';
import { ISortEventData } from '../AggsStateEditor/SortableAggsStateList';

interface IExternalProps {
  graphqlField: string;
}

interface IReduxStateProps {
  columnsState: IColumnsState | null;
}

interface IReduxDisplatProps {
  onFieldSortChange: (
    e: Pick<ISortEventData, Exclude<keyof ISortEventData, 'collection'>>,
  ) => void;
  onColumnPropertyChange: (newColumn: IColumnsState['columns'][0]) => void;
}

type TColumnWithIndex = IColumnsState['columns'][0] & {
  index: number;
};

const mapStateToProps = (
  state: IGlobalState,
  { graphqlField }: IExternalProps,
): IReduxStateProps => ({
  columnsState: !state.configEditor.currentProjectData
    ? null
    : viewProjectIndex(state.configEditor)(graphqlField).columnsState.state,
});
const mapDispatchToProps = (
  dispatch: Dispatch<TReduxAction>,
  { graphqlField }: IExternalProps,
): IReduxDisplatProps => ({
  onFieldSortChange: sortEvent => {
    dispatch({
      type: ActionType.COLUMNS_STATE_FIELD_ORDER_CHANGE,
      payload: {
        graphqlField: graphqlField,
        newIndex: sortEvent.newIndex,
        oldIndex: sortEvent.oldIndex,
      },
    });
  },
  onColumnPropertyChange: newColumn => {
    dispatch({
      type: ActionType.COLUMNS_STATE_COLUMN_PROPERTY_CHANGE,
      payload: {
        graphqlField: graphqlField,
        newField: newColumn,
      },
    });
  },
});

const SortableItem = compose<
  IReduxStateProps &
    IReduxDisplatProps & {
      item: TColumnWithIndex;
    },
  IExternalProps & {
    item: TColumnWithIndex;
    index: number;
  }
>(
  connect(mapStateToProps, mapDispatchToProps),
  SortableElement,
  curry(React.memo)(__, (lastProps, nextProps) =>
    isEqual(lastProps.item, nextProps.item),
  ),
)(({ item, columnsState, onFieldSortChange, onColumnPropertyChange }) => {
  if (!columnsState) {
    return <div>LOADING...</div>;
  }
  const { columns } = columnsState;
  const positionOptions = range(0, columns.length).map(val => ({
    text: String(val),
    value: String(val),
  }));
  const onPositionSelect = (o: ISelectOption) => {
    onFieldSortChange({ newIndex: Number(o.value), oldIndex: item.index });
  };
  const onFieldShowStatuschange = (
    e: React.SyntheticEvent<HTMLInputElement>,
  ) => {
    onColumnPropertyChange({ ...item, show: e.currentTarget.checked });
  };
  const onFieldSortableStatuschange = (
    e: React.SyntheticEvent<HTMLInputElement>,
  ) => {
    onColumnPropertyChange({ ...item, sortable: e.currentTarget.checked });
  };
  return (
    <Card>
      <CardTitle>
        <Grid columns={24}>
          <GridItem span={2}>
            <DragHandle />
          </GridItem>
          <GridItem span={2}>
            <FormField
              input={Select}
              label="Position"
              size="small"
              data={positionOptions}
              onChange={onPositionSelect}
              selectedItem={{
                text: String(item.index),
                value: String(item.index),
              }}
            />
          </GridItem>
          <GridItem>
            <Text>{`${item.field}`}</Text>
          </GridItem>
          <GridItem span={2}>
            <Checkbox
              name="Show"
              label="Show"
              checked={item.show}
              onChange={onFieldShowStatuschange}
            />
          </GridItem>
          <GridItem span={2}>
            <Checkbox
              name="Sortable"
              label="Sortable"
              checked={item.sortable}
              onChange={onFieldSortableStatuschange}
            />
          </GridItem>
        </Grid>
      </CardTitle>
    </Card>
  );
});

const SortableColumnsList = SortableContainer<{ items: any } & IExternalProps>(
  ({ items, graphqlField }) => (
    <div>
      {items.map((item, index) => (
        <SortableItem
          item={item}
          graphqlField={graphqlField}
          index={index}
          key={`item-${index}`}
        />
      ))}
    </div>
  ),
);

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
