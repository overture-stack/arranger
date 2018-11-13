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
import Table, { TableRow, TableCell } from 'mineral-ui/Table';
import Card, { CardTitle, CardBlock, CardDivider } from 'mineral-ui/Card';
import Checkbox from 'mineral-ui/Checkbox';
import styled from 'react-emotion';
import { ActionType } from 'src/store/configEditorReducer';

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
const mapDispatchtoProps = dispatch => ({
  onFieldDisplayNameChange: (field: string) => (displayName: string) =>
    dispatch({
      type: ActionType.EXTENDED_MAPPING_DISPLAY_NAME_CHANGE,
      payload: {
        field,
        value: displayName,
      },
    }),
});

/************************
 * local state model
 ************************/
const EXTENDED_FIELD_TYPES = {
  string: 'string',
  object: 'object',
  text: 'text',
  boolean: 'boolean',
  date: 'date',
  keyword: 'keyword',
  id: 'id',
  long: 'long',
  double: 'double',
  integer: 'integer',
  float: 'float',
  nested: 'nested',
};
const BOOLEAN_FILTER_VALUES = {
  true: 'true',
  false: 'false',
};
interface ILocalState {
  filter: {
    active: string | null;
    isArray: string | null;
    primaryKey: string | null;
    quickSearchEnabled: string | null;
    type: string | null;
    field: string;
  };
  selectedField: string | null;
}
interface IStateContainer {
  state: ILocalState;
  setState: (s: ILocalState) => void;
}
interface ISelectOption {
  text: string;
  value: null | string;
}

/**********************
 * rendered component
 *********************/
const SelectableTableRow = styled(TableRow)`
  background: ${({
    selected = false,
    theme,
  }: {
    selected: boolean;
    theme: any;
  }) => (selected ? theme.color_theme_30 : 'auto')};
`;

interface IInjectedProps extends IReduxStateProps {}
const Dashboard: React.ComponentType<IExternalProps> = connect(
  mapStateToProps,
  mapDispatchtoProps,
)(({ extendedMapping }: IInjectedProps) => {
  if (!extendedMapping) {
    return null;
  }
  const emptyFilter = {
    active: null,
    isArray: null,
    primaryKey: null,
    quickSearchEnabled: null,
    field: '',
    type: null,
  };
  const initialState: ILocalState = { filter: emptyFilter, selectedField: '' };

  const booleanFilterOptions = [
    { text: 'none', value: null },
    ...Object.values(BOOLEAN_FILTER_VALUES).map(val => ({
      text: val,
      value: val,
    })),
  ];

  const onFieldFilterChange = ({ state, setState }: IStateContainer) => (
    e: React.SyntheticEvent<HTMLInputElement>,
  ) =>
    setState({
      ...state,
      filter: { ...state.filter, field: e.currentTarget.value },
    });

  const onFilterOptionSelect = (s: IStateContainer) => (field: string) => (
    e: ISelectOption,
  ) =>
    s.setState({
      ...s.state,
      filter: {
        ...s.state.filter,
        [field]: e.value,
      },
    });

  const setSelectedField = ({ state, setState }: IStateContainer) => (
    field: string,
  ) => () => {
    setState({ ...state, selectedField: field });
  };

  const getFilteredFields = (state: ILocalState): typeof extendedMapping =>
    sortBy(
      extendedMapping.filter(field => {
        const { filter } = state;
        return (
          field.field.includes(filter.field) &&
          (filter.type ? field.type === filter.type : true) &&
          (filter.active !== null
            ? String(field.active) === filter.active
            : true) &&
          (filter.isArray !== null
            ? String(field.isArray) === filter.isArray
            : true) &&
          (filter.primaryKey !== null
            ? String(field.primaryKey) === filter.primaryKey
            : true) &&
          (filter.quickSearchEnabled !== null
            ? String(field.quickSearchEnabled) === filter.quickSearchEnabled
            : true)
        );
      }),
      'field',
    );

  return (
    <Component initialState={initialState}>
      {(stateContainer: IStateContainer) => {
        const { state } = stateContainer;
        const filteredExtendedMapping = getFilteredFields(state);
        const selectedField = extendedMapping.find(
          entry => entry.field === state.selectedField,
        );
        const fieldTableColumns = [{ content: 'Fields', key: 'field' }];
        const fieldTableRows = filteredExtendedMapping.map(entry => ({
          row: () => {
            return (
              <SelectableTableRow
                selected={state.selectedField === entry.field}
                onClick={setSelectedField(stateContainer)(entry.field)}
              >
                <TableCell>{entry.field}</TableCell>
              </SelectableTableRow>
            );
          },
        }));
        return (
          <Grid alignItems="top" columns={12}>
            <GridItem span={7}>
              <Grid alignItems="flex-end" columns={14}>
                <GridItem span={4}>
                  <FormField
                    input={TextInput}
                    label="Field filter"
                    value={state.filter.field}
                    size="small"
                    onChange={onFieldFilterChange(stateContainer)}
                  />
                </GridItem>
                <GridItem span={2}>
                  <FormField
                    input={Select}
                    label="Type"
                    size="small"
                    selectedItem={{
                      text: state.filter.type || '',
                      value: state.filter.type,
                    }}
                    onChange={onFilterOptionSelect(stateContainer)('type')}
                    data={[
                      { text: 'none', value: null },
                      ...Object.values(EXTENDED_FIELD_TYPES).map(val => ({
                        text: val,
                        value: val,
                      })),
                    ]}
                  />
                </GridItem>
                <GridItem span={2}>
                  <FormField
                    input={Select}
                    label="Is active"
                    size="small"
                    data={booleanFilterOptions}
                    selectedItem={{
                      text: state.filter.active || '',
                      value: state.filter.active,
                    }}
                    onChange={onFilterOptionSelect(stateContainer)('active')}
                  />
                </GridItem>
                <GridItem span={2}>
                  <FormField
                    input={Select}
                    label="Is array"
                    size="small"
                    data={booleanFilterOptions}
                    selectedItem={{
                      text: state.filter.isArray,
                      value: state.filter.isArray,
                    }}
                    onChange={onFilterOptionSelect(stateContainer)('isArray')}
                  />
                </GridItem>
                <GridItem span={2}>
                  <FormField
                    input={Select}
                    label="Is primary key"
                    size="small"
                    data={booleanFilterOptions}
                    selectedItem={{
                      text: state.filter.primaryKey || '',
                      value: state.filter.primaryKey,
                    }}
                    onChange={onFilterOptionSelect(stateContainer)(
                      'primaryKey',
                    )}
                  />
                </GridItem>
                <GridItem span={2}>
                  <FormField
                    input={Select}
                    label="Quicksearch enabled"
                    size="small"
                    data={booleanFilterOptions}
                    selectedItem={{
                      text: state.filter.quickSearchEnabled || '',
                      value: state.filter.quickSearchEnabled,
                    }}
                    onChange={onFilterOptionSelect(stateContainer)(
                      'quickSearchEnabled',
                    )}
                  />
                </GridItem>
              </Grid>
              <Table
                rowKey="field"
                columns={fieldTableColumns}
                data={fieldTableRows}
              />
            </GridItem>
            <GridItem span={5}>
              {selectedField && (
                <Card>
                  <CardTitle>Field: {selectedField.field}</CardTitle>
                  <CardDivider />
                  <CardBlock>
                    <FormField
                      input={TextInput}
                      label="Display Name"
                      value={selectedField.displayName}
                      size="medium"
                    />
                  </CardBlock>
                  <CardBlock>
                    <Checkbox
                      name="Active"
                      label="Active"
                      checked={selectedField.active}
                    />
                  </CardBlock>
                  <CardBlock>
                    <Checkbox
                      name="Quicksearch enabled"
                      label="Quicksearch enabled"
                      checked={selectedField.quickSearchEnabled}
                    />
                  </CardBlock>
                  <CardBlock>
                    <Checkbox
                      name="Is primary key"
                      label="Is primary key"
                      checked={selectedField.primaryKey}
                    />
                  </CardBlock>
                  <CardBlock>
                    <Checkbox
                      name="Is array"
                      label="Is array"
                      checked={selectedField.isArray}
                    />
                  </CardBlock>
                </Card>
              )}
            </GridItem>
          </Grid>
        );
      }}
    </Component>
  );
});

export default Dashboard;

// field: String!;
// type: ExtendedFieldType!;
// displayName: String!;
// active: Boolean!;
// isArray: Boolean!;
// primaryKey: Boolean!;
// quickSearchEnabled: Boolean!;
// unit: String;
// displayValues: JSON!;
// rangeStep: Float;
