import * as React from 'react';
import Card, { CardTitle } from 'mineral-ui/Card';
import Text from 'mineral-ui/Text';
import Grid, { GridItem } from 'mineral-ui/Grid';
import Checkbox from 'mineral-ui/Checkbox';
import { FormField } from 'mineral-ui/Form';
import Select from 'mineral-ui/Select';
import { SortableContainer, SortableElement } from 'react-sortable-hoc';
import { connect } from 'react-redux';
import { compose } from 'recompose';
import { range } from 'lodash';
import { curry, equals, __ } from 'ramda'; //doc: https://ramdajs.com/docs/#curry

import {
  mapStateToProps,
  mapDispatchToProps,
  IReduxStateProps,
  IReduxDispatchProps,
} from './ReduxContainer';
import { IAggsStateEntryWithIndex } from './ReduxContainer';
import { ISelectOption } from '../ExtendedMappingEditor/FieldsFilterDisplay';
import { DragHandle } from '../SortableList';

export interface ISortEventData {
  oldIndex: number;
  newIndex: number;
  collection: number;
}

interface ISortableItemExternalProps {
  item: IAggsStateEntryWithIndex;
  index: number;
  allItems: Array<IAggsStateEntryWithIndex>;
  graphqlField: string;
}

const SortableItem = compose<
  ISortableItemExternalProps & IReduxStateProps & IReduxDispatchProps,
  ISortableItemExternalProps
>(
  SortableElement,
  connect(mapStateToProps, mapDispatchToProps),
  curry(React.memo)(__, (lastProps, nextProps) =>
    equals(lastProps.item, nextProps.item),
  ),
)(({ item, aggsState, onFieldSortChange, onFieldPropertyChange }) => {
  const positionOptions = range(0, aggsState.length).map(val => ({
    text: String(val),
    value: String(val),
  }));
  const onPositionSelect = (option: ISelectOption) => {
    onFieldSortChange(item, Number(option.value));
  };
  const onActiveStateChange = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const newItem: typeof item = {
      ...item,
      active: e.currentTarget.checked,
    };
    onFieldPropertyChange({ newField: newItem });
  };
  const onShownStateChange = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const newItem: typeof item = {
      ...item,
      show: e.currentTarget.checked,
    };
    onFieldPropertyChange({ newField: newItem });
  };
  return (
    <Card>
      <CardTitle>
        <Grid columns={24}>
          <GridItem span={1}>
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
              name="Active"
              label="Active"
              checked={item.active}
              onChange={onActiveStateChange}
            />
          </GridItem>
          <GridItem span={2}>
            <Checkbox
              name="Shown"
              label="Shown"
              checked={item.show}
              onChange={onShownStateChange}
            />
          </GridItem>
        </Grid>
      </CardTitle>
    </Card>
  );
});

interface IExternalProps {
  graphqlField: string;
  items: Array<IAggsStateEntryWithIndex>;
  onSortEnd: (any) => any;
}
export default SortableContainer(({ items, graphqlField }: IExternalProps) => (
  <div>
    {items.map((item, index) => (
      <SortableItem
        graphqlField={graphqlField}
        allItems={items}
        key={`item-${index}`}
        item={item}
        index={index}
      />
    ))}
  </div>
));
