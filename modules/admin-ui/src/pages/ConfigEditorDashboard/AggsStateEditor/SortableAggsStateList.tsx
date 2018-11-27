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

import { IAggsStateEntry } from 'src/pages/VersionDashboard/AddProjectForm/types';
import {
  mapStateToProps,
  mapDispatchToProps,
  IReduxStateProps,
  IReduxDispatchProps,
} from './index';

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

export interface IAggsStateEntryWithIndex extends IAggsStateEntry {
  index: number;
}

interface ISortableItemExternalProps {
  item: IAggsStateEntryWithIndex;
  index: number;
  onSortChange: (e: ISortEventData) => void;
  allItems: Array<IAggsStateEntryWithIndex>;
  graphqlField: string;
  aggsState: IAggsStateEntry[] | undefined;
}
const DragHandle = SortableHandle(() => <IconMenu size="large" color="gray" />);
const SortableItem = compose<
  ISortableItemExternalProps,
  ISortableItemExternalProps
>(SortableElement)(({ item, aggsState }) => {
  console.log('aggsState: ', aggsState);
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
});

export default compose<
  IExternalProps & IReduxStateProps & IReduxDispatchProps,
  IExternalProps
>(SortableContainer, connect(mapStateToProps, mapDispatchToProps))(
  ({ items, onSortEnd, graphqlField, aggsState }) => {
    return (
      <div>
        {items.map((item, index) => (
          <SortableItem
            aggsState={aggsState}
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
