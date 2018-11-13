import * as React from 'react';
import Component from 'react-component-component';
import { connect } from 'react-redux';
import { sortBy } from 'lodash';
import { IGlobalState } from 'src/store';
import { IExtendedMapping } from '../VersionDashboard/AddProjectForm/types';
import { FormField } from 'mineral-ui/Form';
import TextInput from 'mineral-ui/TextInput';
import Grid, { GridItem } from 'mineral-ui/Grid';
import Select from 'mineral-ui/Select';

/***************
 * redux container
 **************/
export interface IExternalProps {
  graphqlField: string;
}
interface IReduxStateProps {
  extendedMapping?: IExtendedMapping;
}
const mapStateToProps = (
  state: IGlobalState,
  { graphqlField }: IExternalProps,
): IReduxStateProps => {
  if (!state.configEditor.currentProjectData) {
    return {};
  } else {
    const currentProjectIndexData = state.configEditor.currentProjectData.project.indices.find(
      index => index.graphqlField === graphqlField,
    );
    if (currentProjectIndexData) {
      return {
        extendedMapping: currentProjectIndexData.extended,
      };
    } else {
      return {};
    }
  }
};
const mapDispatchtoProps = () => ({});

/************************
 * local state model
 ************************/
enum BooleanFilterValue {
  true = 'true',
  false = 'false',
  undefined = 'undefined',
}
interface ILocalState {
  filter: {
    active: BooleanFilterValue;
    isArray: BooleanFilterValue;
    primaryKey: BooleanFilterValue;
    quicksearchEnabled: BooleanFilterValue;
    type: string;
    field: string;
  };
  selectedField: string | null;
}
interface IStateContainer {
  state: ILocalState;
  setState: (s: ILocalState) => void;
}

/**********************
 * rendered component
 *********************/
interface IInjectedProps extends IReduxStateProps {}
const Dashboard: React.ComponentType<IExternalProps> = connect(
  mapStateToProps,
  mapDispatchtoProps,
)(({ extendedMapping }: IInjectedProps) => {
  if (!extendedMapping) {
    return null;
  }
  const initialState: ILocalState = {
    filter: {
      active: BooleanFilterValue.undefined,
      isArray: BooleanFilterValue.undefined,
      primaryKey: BooleanFilterValue.undefined,
      quicksearchEnabled: BooleanFilterValue.undefined,
      field: '',
      type: '',
    },
    selectedField: '',
  };

  const filterByField = ({ state, setState }: IStateContainer) => e =>
    setState({
      ...state,
      filter: { ...state.filter, field: e.currentTarget.value },
    });

  const getFilteredFields = (state: ILocalState): typeof extendedMapping =>
    sortBy(
      extendedMapping.filter(field => {
        const { filter } = state;
        return field.field.includes(filter.field);
      }),
      'field',
    );

  const setSelectedField = ({ state, setState }: IStateContainer) => (
    field: string,
  ) => () => {
    setState({ ...state, selectedField: field });
  };

  return (
    <Component initialState={initialState}>
      {(stateContainer: IStateContainer) => {
        const { state } = stateContainer;
        const filteredExtendedMapping = getFilteredFields(state);
        return (
          <div>
            <Grid alignItems="center" columns={12}>
              <GridItem span={2}>
                <FormField
                  input={TextInput}
                  label="Field filter"
                  value={state.filter.field}
                  size="medium"
                  onChange={filterByField(stateContainer)}
                />
              </GridItem>
              <GridItem span={2}>
                <FormField
                  input={TextInput}
                  label="Type"
                  value={state.filter.field}
                  size="medium"
                  onChange={filterByField(stateContainer)}
                />
              </GridItem>
              <GridItem span={2}>
                <FormField
                  input={Select}
                  label="Field filter"
                  data={[]}
                  size="medium"
                />
              </GridItem>
              <GridItem span={2}>
                <FormField
                  input={Select}
                  label="Field filter"
                  data={[]}
                  size="medium"
                />
              </GridItem>
              <GridItem span={2}>
                <FormField
                  input={Select}
                  label="Field filter"
                  data={[]}
                  size="medium"
                />
              </GridItem>
              <GridItem span={2}>
                <FormField
                  input={Select}
                  label="Field filter"
                  data={[]}
                  size="medium"
                />
              </GridItem>
            </Grid>
            <Grid alignItems="top" columns={12}>
              <GridItem span={6}>
                {filteredExtendedMapping.map(field => (
                  <div
                    key={field.field}
                    onClick={setSelectedField(stateContainer)(field.field)}
                  >
                    {field.field}
                  </div>
                ))}
              </GridItem>
              <GridItem span={6}>
                <div>{state.selectedField}</div>
              </GridItem>
            </Grid>
          </div>
        );
      }}
    </Component>
  );
});

export default Dashboard;
