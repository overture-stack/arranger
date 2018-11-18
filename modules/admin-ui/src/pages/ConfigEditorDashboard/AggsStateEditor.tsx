import * as React from 'react';
import { connect } from 'react-redux';
import Component from 'react-component-component';
import { IGlobalState } from 'src/store';
import Card, { CardTitle } from 'mineral-ui/Card';
import { FormField } from 'mineral-ui/Form';
import TextInput from 'mineral-ui/TextInput';
import Text from 'mineral-ui/Text';
import IconMenu from 'mineral-ui-icons/IconMenu';
import Select from 'mineral-ui/Select';
import Grid, { GridItem } from 'mineral-ui/Grid';
import Checkbox from 'mineral-ui/Checkbox';
import {
  SortableContainer,
  SortableElement,
  SortableHandle,
} from 'react-sortable-hoc';
import {
  IAggsState,
  IAggsStateEntry,
} from '../VersionDashboard/AddProjectForm/types';
import { withDebouncedOnChange } from 'src/utils/';

interface IAggsStateEntryWithIndex extends IAggsStateEntry {
  index: number;
}

const DragHandle = SortableHandle(() => <IconMenu size="large" color="gray" />);

const SortableItem: React.ComponentType<{
  item: IAggsStateEntryWithIndex;
  index: number;
}> = SortableElement(({ item }) => (
  <Card>
    <CardTitle>
      <Grid columns={24}>
        <GridItem span={1}>
          <DragHandle />
        </GridItem>
        <GridItem>
          <Text>{`${item.field}`}</Text>
        </GridItem>
        <GridItem span={2}>
          <Checkbox name="Active" label="Active" checked={item.active} />
        </GridItem>
        <GridItem span={2}>
          <Checkbox name="Shown" label="Shown" checked={item.show} />
        </GridItem>
        <GridItem span={2}>
          <FormField
            input={Select}
            label="Position"
            size="small"
            data={[0, 1, 2, 3, 4].map(val => ({
              text: val,
              value: val,
            }))}
            selectedItem={{ text: item.index, value: item.index }}
          />
        </GridItem>
      </Grid>
    </CardTitle>
  </Card>
));

const SortableList: React.ComponentType<{
  items: Array<IAggsStateEntryWithIndex>;
  useDragHandle?: boolean;
}> = SortableContainer(({ items }) => (
  <div>
    {items.map((item, index) => (
      <SortableItem key={`item-${index}`} index={index} item={item} />
    ))}
  </div>
));

/***************
 * main component
 ***************/
interface IExternalProps {
  graphqlField: string;
}

interface IReduxStateProps {
  aggsState?: IAggsState;
}

interface IReduxDispatchProps {}

const DebouncedInput = withDebouncedOnChange()(TextInput);

export default connect(
  (state: IGlobalState, { graphqlField }: IExternalProps): IReduxStateProps => {
    if (!state.configEditor.currentProjectData) {
      return {};
    } else {
      const currentProjectIndexData = state.configEditor.currentProjectData.project.indices.find(
        index => index.graphqlField === graphqlField,
      );
      if (currentProjectIndexData) {
        return {
          aggsState: currentProjectIndexData.aggsState.state,
        };
      } else {
        return {};
      }
    }
  },
  (): IReduxDispatchProps => ({}),
)(({ aggsState }: IExternalProps & IReduxStateProps & IReduxDispatchProps) => {
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

  return (
    <Component initialState={initialState}>
      {(s: IStateContainer) => (
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
              <FormField input={Select} label="Active" size="small" data={[]} />
            </GridItem>
            <GridItem>
              <FormField input={Select} label="Show" size="small" data={[]} />
            </GridItem>
          </Grid>
          <SortableList
            items={aggsStateWithIndex.filter(i =>
              i.field.includes(s.state.fieldFilter),
            )}
            useDragHandle={true}
          />
        </div>
      )}
    </Component>
  );
});
