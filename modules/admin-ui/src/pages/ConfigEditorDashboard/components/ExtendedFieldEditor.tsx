import * as React from 'react';
import Card, { CardTitle, CardBlock, CardDivider } from 'mineral-ui/Card';
import Checkbox from 'mineral-ui/Checkbox';
import { FormField } from 'mineral-ui/Form';
import TextInput from 'mineral-ui/TextInput';
import Select from 'mineral-ui/Select';
import { connect } from 'react-redux';

import { EXTENDED_FIELD_TYPES } from '../ExtendedMappingEditor';
import {
  IExtendedMappingField,
  IExtendedMapping,
} from 'src/pages/VersionDashboard/AddProjectForm/types';
import { ActionType } from 'src/store/configEditorReducer';
import { Dispatch } from 'redux';
import { IGlobalState } from 'src/store';

interface IExternalProps {
  graphqlField: string;
  fieldData: IExtendedMappingField;
}

/***************
 * redux container
 **************/
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

// field: String!;
// displayName: String!;
// active: Boolean!;
// primaryKey: Boolean!;
// quickSearchEnabled: Boolean!;
// type: ExtendedFieldType!;
// isArray: Boolean!;
// rangeStep: Float;

// unit: String;
// displayValues: JSON!;

interface IReduxDispatchProps {
  onFieldDisplayNameChange: (
    currentField: IExtendedMappingField,
  ) => (newDisplayName: string) => void;
  onFieldTypeChange: (
    currentField: IExtendedMappingField,
  ) => (newType: string) => void;
  onFieldActiveChange: (
    currentField: IExtendedMappingField,
  ) => (newActiveState: boolean) => void;
  onFieldQuicksearchStateChange: (
    currentField: IExtendedMappingField,
  ) => (newQuicksearchState: boolean) => void;
  onFieldPrimarykeyStateChange: (
    currentField: IExtendedMappingField,
  ) => (newState: boolean) => void;
  onFieldIsArrayStateChange: (
    currentField: IExtendedMappingField,
  ) => (newState: boolean) => void;
  onFieldRangeStepChange: (
    currentField: IExtendedMappingField,
  ) => (newValue: number) => void;
}
const mapDispatchtoProps = (
  dispatch: Dispatch,
  ownProps: IExternalProps,
): IReduxDispatchProps => ({
  onFieldDisplayNameChange: currentField => newDisplayName =>
    dispatch({
      type: ActionType.EXTENDED_MAPPING_FIELD_CHANGE,
      payload: {
        graphqlField: ownProps.graphqlField,
        fieldConfig: {
          ...currentField,
          displayName: newDisplayName,
        },
      },
    }),
  onFieldTypeChange: currentField => newType =>
    dispatch({
      type: ActionType.EXTENDED_MAPPING_FIELD_CHANGE,
      payload: {
        graphqlField: ownProps.graphqlField,
        fieldConfig: {
          ...currentField,
          type: newType,
        },
      },
    }),
  onFieldActiveChange: currentField => newActiveState =>
    dispatch({
      type: ActionType.EXTENDED_MAPPING_FIELD_CHANGE,
      payload: {
        graphqlField: ownProps.graphqlField,
        fieldConfig: {
          ...currentField,
          active: newActiveState,
        },
      },
    }),
  onFieldQuicksearchStateChange: currentField => newState =>
    dispatch({
      type: ActionType.EXTENDED_MAPPING_FIELD_CHANGE,
      payload: {
        graphqlField: ownProps.graphqlField,
        fieldConfig: {
          ...currentField,
          quickSearchEnabled: newState,
        },
      },
    }),
  onFieldPrimarykeyStateChange: currentField => newState =>
    dispatch({
      type: ActionType.EXTENDED_MAPPING_FIELD_CHANGE,
      payload: {
        graphqlField: ownProps.graphqlField,
        fieldConfig: {
          ...currentField,
          primaryKey: newState,
        },
      },
    }),
  onFieldIsArrayStateChange: currentField => newState =>
    dispatch({
      type: ActionType.EXTENDED_MAPPING_FIELD_CHANGE,
      payload: {
        graphqlField: ownProps.graphqlField,
        fieldConfig: {
          ...currentField,
          isArray: newState,
        },
      },
    }),
  onFieldRangeStepChange: currentField => newValue =>
    dispatch({
      type: ActionType.EXTENDED_MAPPING_FIELD_CHANGE,
      payload: {
        graphqlField: ownProps.graphqlField,
        fieldConfig: {
          ...currentField,
          rangeStep: newValue,
        },
      },
    }),
});

const Component: React.ComponentType<
  IExternalProps & IReduxStateProps & IReduxDispatchProps
> = ({
  fieldData,
  onFieldDisplayNameChange,
  onFieldTypeChange,
  onFieldActiveChange,
  onFieldQuicksearchStateChange,
  onFieldPrimarykeyStateChange,
  onFieldIsArrayStateChange,
  onFieldRangeStepChange,
}) => {
  const onDisplayNameChange = (e: React.SyntheticEvent<HTMLInputElement>) =>
    onFieldDisplayNameChange(fieldData)(e.currentTarget.value);

  const onTypeChange = e => onFieldTypeChange(fieldData)(e.value);

  const onActiveStateToggle = () =>
    onFieldActiveChange(fieldData)(!fieldData.active);

  const onQuicksearchStateToggle = () =>
    onFieldQuicksearchStateChange(fieldData)(!fieldData.quickSearchEnabled);

  const onPrimarykeyStateChange = () =>
    onFieldPrimarykeyStateChange(fieldData)(!fieldData.primaryKey);

  const onIsArrayStateChange = () =>
    onFieldIsArrayStateChange(fieldData)(!fieldData.isArray);

  const onRangeStepChange = (e: React.SyntheticEvent<HTMLInputElement>) =>
    onFieldRangeStepChange(fieldData)(Number(e.currentTarget.value));

  return (
    <Card>
      <CardTitle>Field: {fieldData.field}</CardTitle>
      <CardDivider />
      <CardBlock>
        <FormField
          input={TextInput}
          label="Display Name"
          size="medium"
          value={fieldData.displayName}
          onChange={onDisplayNameChange}
        />
      </CardBlock>
      <CardBlock>
        <FormField
          input={Select}
          label="Aggregation Type"
          size="medium"
          data={Object.values(EXTENDED_FIELD_TYPES).map(val => ({
            text: val,
            value: val,
          }))}
          selectedItem={{ text: fieldData.type, value: fieldData.type }}
          onChange={onTypeChange}
        />
      </CardBlock>
      <CardBlock>
        <Checkbox
          name="Active"
          label="Active"
          checked={fieldData.active}
          onChange={onActiveStateToggle}
        />
      </CardBlock>
      <CardBlock>
        <Checkbox
          name="Quicksearch enabled"
          label="Quicksearch enabled"
          checked={fieldData.quickSearchEnabled}
          onChange={onQuicksearchStateToggle}
        />
      </CardBlock>
      <CardBlock>
        <Checkbox
          name="Is primary key"
          label="Is primary key"
          checked={fieldData.primaryKey}
          onChange={onPrimarykeyStateChange}
        />
      </CardBlock>
      <CardBlock>
        <Checkbox
          name="Is array"
          label="Is array"
          checked={fieldData.isArray}
          onChange={onIsArrayStateChange}
        />
      </CardBlock>
      {[
        EXTENDED_FIELD_TYPES.float as string,
        EXTENDED_FIELD_TYPES.double as string,
        EXTENDED_FIELD_TYPES.long as string,
        EXTENDED_FIELD_TYPES.integer as string,
      ].includes(fieldData.type) && (
        <CardBlock>
          <FormField
            label="Number range step"
            size="medium"
            type="number"
            step={fieldData.type === EXTENDED_FIELD_TYPES.integer ? 1 : 0.0001}
            input={TextInput}
            value={fieldData.rangeStep}
            onChange={onRangeStepChange}
          />
        </CardBlock>
      )}
    </Card>
  );
};

export default connect(mapStateToProps, mapDispatchtoProps)(Component);
