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
import Text from 'mineral-ui/Text';
import Checkbox from 'mineral-ui/Checkbox';
import { range, isEqual } from 'lodash';
import { SortableContainer, SortableElement } from 'react-sortable-hoc';
import { compose } from 'recompose';

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
  onFieldSortChange: (e: ISortEventData) => void;
}

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
  onFieldSortChange: (sortEvent: ISortEventData) => {
    dispatch({
      type: ActionType.COLUMNS_STATE_FIELD_ORDER_CHANGE,
      payload: {
        graphqlField: graphqlField,
        newIndex: sortEvent.newIndex,
        oldIndex: sortEvent.oldIndex,
      },
    });
  },
});

const SortableItem = compose<
  IReduxStateProps &
    IReduxDisplatProps & {
      item: any;
    },
  IExternalProps & {
    item: any;
    index: number;
  }
>(connect(mapStateToProps, mapDispatchToProps), SortableElement)(
  React.memo(
    ({ item, columnsState, onFieldSortChange }) => {
      if (!columnsState) {
        return <div>LOADING...</div>;
      }
      const { columns } = columnsState;
      const positionOptions = range(0, columns.length).map(val => ({
        text: String(val),
        value: String(val),
      }));
      const onPositionSelect = (data: ISelectOption) => {
        console.log('data: ', data);
      };
      const onFieldShowStatuschange = (field: string) => (
        e: React.SyntheticEvent<HTMLInputElement>,
      ) => {
        console.log('field: ', field);
      };
      const onFieldSortableStatuschange = (field: string) => (
        e: React.SyntheticEvent<HTMLInputElement>,
      ) => {
        // onFieldSortChange({ collection: null, newIndex: e.currentTarget.value, oldIndex });
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
                  onChange={onFieldShowStatuschange(item.field)}
                />
              </GridItem>
              <GridItem span={2}>
                <Checkbox
                  name="Sortable"
                  label="Sortable"
                  checked={item.sortable}
                  onChange={onFieldSortableStatuschange(item.field)}
                />
              </GridItem>
            </Grid>
          </CardTitle>
        </Card>
      );
    },
    (prev, next) => isEqual(prev.item, next.item),
  ),
);

const SortableColumnsList = SortableContainer<{ items: any } & IExternalProps>(
  ({ items, graphqlField }) => {
    const columnsWithIndex = items.map((col, index) => ({ ...col, index }));
    return (
      <div>
        {columnsWithIndex.map((item, index) => (
          <SortableItem
            item={item}
            graphqlField={graphqlField}
            index={index}
            key={`item-${index}`}
          />
        ))}
      </div>
    );
  },
);

export default connect(mapStateToProps, mapDispatchToProps)(
  ({
    columnsState,
    graphqlField,
    onFieldSortChange,
  }: IExternalProps & IReduxStateProps & IReduxDisplatProps) => {
    if (!columnsState) {
      return <div>LOADING...</div>;
    }

    const { columns } = columnsState;

    const onSortEnd = (data: ISortEventData) => {
      onFieldSortChange(data);
    };

    return (
      <div>
        <SortableColumnsList
          graphqlField={graphqlField}
          items={columns}
          useDragHandle={true}
          onSortEnd={onSortEnd}
        />
      </div>
    );
  },
);
