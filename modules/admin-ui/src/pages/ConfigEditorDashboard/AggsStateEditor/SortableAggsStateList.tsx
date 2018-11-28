import * as React from 'react';
import Card, { CardTitle } from 'mineral-ui/Card';
import Text from 'mineral-ui/Text';
import IconMenu from 'mineral-ui-icons/IconMenu';
import Grid, { GridItem } from 'mineral-ui/Grid';
import Checkbox from 'mineral-ui/Checkbox';
import {
  SortableContainer,
  SortableElement,
  SortableHandle,
} from 'react-sortable-hoc';
import { connect } from 'react-redux';
import { compose } from 'recompose';

import {
  mapStateToProps,
  mapDispatchToProps,
  IReduxStateProps,
  IReduxDispatchProps,
} from './ReduxContainer';
import { IAggsStateEntryWithIndex } from './ReduxContainer';
import { isEqual } from 'apollo-utilities';

export interface ISortEventData {
  oldIndex: number;
  newIndex: number;
  collection: number;
}

interface IExternalProps {
  graphqlField: string;
  items: Array<IAggsStateEntryWithIndex>;
  useDragHandle?: boolean;
  onSortEnd: (any) => any;
}

interface ISortableItemExternalProps {
  item: IAggsStateEntryWithIndex;
  index: number;
  onSortChange: (e: ISortEventData) => void;
  allItems: Array<IAggsStateEntryWithIndex>;
  graphqlField: string;
}
const DragHandle = SortableHandle(() => <IconMenu size="large" color="gray" />);
const SortableItem = compose<
  ISortableItemExternalProps & IReduxStateProps & IReduxDispatchProps,
  ISortableItemExternalProps
>(SortableElement, connect(mapStateToProps, mapDispatchToProps))(
  React.memo(
    ({ item, aggsState }) => {
      return (
        <Card>
          <CardTitle>
            <Grid columns={24}>
              <GridItem span={1}>
                <DragHandle />
              </GridItem>
              <GridItem>
                <Text>{`${item.index}/ ${item.field}`}</Text>
              </GridItem>
              <GridItem span={2}>
                <Checkbox name="Active" label="Active" checked={item.active} />
              </GridItem>
              <GridItem span={2}>
                <Checkbox name="Shown" label="Shown" checked={item.show} />
              </GridItem>
            </Grid>
          </CardTitle>
        </Card>
      );
    },
    (props, nextProps) => {
      return isEqual(props.item, nextProps.item);
    },
  ),
);

export default compose<IExternalProps, IExternalProps>(SortableContainer)(
  ({ items, onSortEnd, graphqlField }) => {
    return (
      <div>
        {items.map((item, index) => (
          <SortableItem
            graphqlField={graphqlField}
            allItems={items}
            key={`item-${index}`}
            item={item}
            index={index}
            onSortChange={onSortEnd}
          />
        ))}
      </div>
    );
  },
);
