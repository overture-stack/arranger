import * as React from 'react';
import Component from 'react-component-component';
import { connect } from 'react-redux';
import { IGlobalState } from 'src/store';
import Grid, { GridItem } from 'mineral-ui/Grid';
import Table, { TableCell } from 'mineral-ui/Table';
import { prop, sortBy } from 'ramda';

import { Dispatch } from 'redux';
import ExtendedFieldEditor from 'src/pages/ConfigEditorDashboard/ExtendedMappingEditor/ExtendedFieldEditor';
import FieldsFilter, { ISelectOption } from './FieldsFilterDisplay';
import SelectableTableRow from 'src/components/SelectableTableRow';
import { IExtendedMapping } from '../../VersionDashboard/AddProjectForm/types';

/***************
 * redux container
 **************/
export interface IExternalProps {
  graphqlField: string;
}
interface IReduxStateProps {
  extendedMapping?: IExtendedMapping;
}
export const mapStateToProps = (
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
interface IReduxDispatchProps {}
const mapDispatchtoProps = (
  dispatch: Dispatch,
  ownProps: IExternalProps,
): IReduxDispatchProps => ({});

/************************
 * local state model
 ************************/
export interface ILocalState {
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

export const EXTENDED_FIELD_TYPES: {
  string: 'string';
  object: 'object';
  text: 'text';
  boolean: 'boolean';
  date: 'date';
  keyword: 'keyword';
  id: 'id';
  long: 'long';
  double: 'double';
  integer: 'integer';
  float: 'float';
  nested: 'nested';
} = {
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

/**********************
 * rendered component
 *********************/
const FieldsTable = React.memo(Table, ({ data }, { data: nextData }) => {
  const toSelectedState = ({ selected }) => selected;
  const lastSelectedIndex = data.map(toSelectedState).indexOf(true);
  const nextSelectedIndex = nextData.map(toSelectedState).indexOf(true);
  return (
    nextData.length === data.length && lastSelectedIndex === nextSelectedIndex
  );
});

interface IInjectedProps extends IReduxStateProps, IReduxDispatchProps {}
const Dashboard: React.ComponentType<IExternalProps> = connect(
  mapStateToProps,
  mapDispatchtoProps,
)(({ extendedMapping, graphqlField }: IInjectedProps & IExternalProps) => {
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
  const initialState: ILocalState = {
    filter: emptyFilter,
    selectedField: extendedMapping[0].field,
  };

  const onFieldFilterChange = ({ state, setState }: IStateContainer) => (
    e: React.SyntheticEvent<HTMLInputElement>,
  ) =>
    setState({
      ...state,
      filter: { ...state.filter, field: e.currentTarget.value },
    });

  const onFilterOptionSelect = (s: IStateContainer) => (
    field: keyof typeof extendedMapping[0],
  ) => (e: ISelectOption) =>
    s.setState({
      ...s.state,
      filter: {
        ...s.state.filter,
        [field]: e.value,
      },
    });

  const setSelectedField = (s: IStateContainer) => (field: string) => () => {
    s.setState({ ...s.state, selectedField: field });
  };

  const getSelectedField = (s: IStateContainer) =>
    extendedMapping.find(entry => entry.field === s.state.selectedField);

  const getFilteredFields = (state: ILocalState): typeof extendedMapping =>
    sortBy(prop('field'))(
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
    );

  return (
    <Component initialState={initialState}>
      {(s: IStateContainer) => {
        const filteredExtendedMapping = getFilteredFields(s.state);
        const selectedField = getSelectedField(s);
        const fieldTableColumns = [
          {
            content: `Fields (${filteredExtendedMapping.length})`,
            key: 'field',
          },
        ];
        const fieldTableRows = filteredExtendedMapping.map(entry => ({
          selected: s.state.selectedField === entry.field,
          row: props => {
            return (
              <SelectableTableRow
                selected={s.state.selectedField === entry.field}
                onClick={setSelectedField(s)(entry.field)}
              >
                <TableCell>{entry.field}</TableCell>
              </SelectableTableRow>
            );
          },
        }));
        return (
          <div style={{ minHeight: '800px' }}>
            <Grid alignItems="top" columns={12}>
              <GridItem span={7}>
                <FieldsFilter
                  filterState={s.state}
                  onFieldFilterChange={onFieldFilterChange(s)}
                  onTypeSelect={onFilterOptionSelect(s)('type')}
                  onActiveStateSelect={onFilterOptionSelect(s)('active')}
                  onIsArraySelect={onFilterOptionSelect(s)('isArray')}
                  onPrimaryStateSelect={onFilterOptionSelect(s)('primaryKey')}
                  onQuicksearchEnabledSelect={onFilterOptionSelect(s)(
                    'quickSearchEnabled',
                  )}
                />
                <FieldsTable
                  title={`Fields`}
                  hideTitle={true}
                  rowKey="field"
                  columns={fieldTableColumns}
                  data={fieldTableRows}
                />
              </GridItem>
              <GridItem span={5}>
                {selectedField && (
                  <ExtendedFieldEditor
                    graphqlField={graphqlField}
                    fieldData={selectedField}
                  />
                )}
              </GridItem>
            </Grid>
          </div>
        );
      }}
    </Component>
  );
});

export default Dashboard;
