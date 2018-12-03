import * as React from 'react';
import { connect } from 'react-redux';
import { FormField } from 'mineral-ui/Form';
import Select from 'mineral-ui/Select';
import Card, { CardTitle } from 'mineral-ui/Card';
import Grid, { GridItem } from 'mineral-ui/Grid';
import Text from 'mineral-ui/Text';
import Checkbox from 'mineral-ui/Checkbox';
import { SortableContainer, SortableElement } from 'react-sortable-hoc';
import { compose } from 'recompose';
import { equals, range, curry, __ } from 'ramda'; //doc: https://ramdajs.com/docs/#curry

import { TColumnWithIndex } from './';
import { DragHandle } from '../SortableList';
import { ISelectOption } from '../ExtendedMappingEditor/FieldsFilterDisplay';
import {
  IReduxExternalProps,
  IReduxStateProps,
  IReduxDisplatProps,
  mapStateToProps,
  mapDispatchToProps,
} from './ReduxContainer';

interface IExternalProps extends IReduxExternalProps {}

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
    equals(lastProps.item, nextProps.item),
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
    if (item.canChangeShow) {
      onColumnPropertyChange({ ...item, show: e.currentTarget.checked });
    }
  };
  const onFieldSortableStatuschange = (
    e: React.SyntheticEvent<HTMLInputElement>,
  ) => {
    onColumnPropertyChange({ ...item, sortable: e.currentTarget.checked });
  };
  const onFieldShowMutabilityChange = (
    e: React.SyntheticEvent<HTMLInputElement>,
  ) => {
    onColumnPropertyChange({
      ...item,
      canChangeShow: e.currentTarget.checked,
      show: false,
    });
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
              label="Position"
              size="small"
              input={Select}
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
              name="Active"
              label="Active"
              checked={item.canChangeShow}
              onChange={onFieldShowMutabilityChange}
            />
          </GridItem>
          <GridItem span={2}>
            <Checkbox
              name="Default"
              label="Default"
              checked={item.show}
              onChange={onFieldShowStatuschange}
              disabled={!item.canChangeShow}
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

export default SortableContainer<{ items: any } & IExternalProps>(
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
