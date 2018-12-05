import * as React from 'react';
import { connect } from 'react-redux';
import Grid, { GridItem } from 'mineral-ui/Grid';
import Card, { CardTitle, CardBlock, CardDivider } from 'mineral-ui/Card';
import Text from 'mineral-ui/Text';
import { FormField } from 'mineral-ui/Form';
import TextInput from 'mineral-ui/TextInput';
import Select from 'mineral-ui/Select';
import Checkbox from 'mineral-ui/Checkbox';
import Button from 'mineral-ui/Button';

import {
  mapStateToProps,
  mapDispatchToProps,
  IReduxDispatchProps,
  IReduxExternalProps,
  IReduxStateProps,
} from './ReduxContainer';
import { ISelectOption } from '../ExtendedMappingEditor/FieldsFilterDisplay';

interface IQuicksearchFieldConfigEditorExternalProps
  extends IReduxExternalProps {
  field: string;
}
export default connect(mapStateToProps, mapDispatchToProps)(
  (
    props: IReduxStateProps &
      IReduxDispatchProps &
      IReduxExternalProps &
      IQuicksearchFieldConfigEditorExternalProps,
  ) => {
    const {
      field,
      graphqlField,
      allFields,
      quicksearchConfigs,
      onFieldPropertyChange,
    } = props;
    const editingField = quicksearchConfigs.find(f => f.field === field);
    if (!editingField) {
      return null;
    }
    type TDataProperty = keyof typeof editingField;
    interface IFieldPropertyDelta {
      property: TDataProperty;
      value: (typeof editingField)[IFieldPropertyDelta['property']];
    }

    /*******
     * event handlers
     *******/
    const onDisplayNameChange = (e: React.SyntheticEvent<HTMLInputElement>) => {
      onFieldPropertyChange({
        ...editingField,
        displayName: e.currentTarget.value,
      });
    };
    const onPropertyChange = (delta: IFieldPropertyDelta) => () => {
      onFieldPropertyChange({
        ...editingField,
        [delta.property]: delta.value,
      });
    };
    const onSearchFieldAdded = (e: ISelectOption) => {
      onFieldPropertyChange({
        ...editingField,
        searchFields: e.value
          ? [...editingField.searchFields, e.value]
          : editingField.searchFields,
      });
    };
    const onSearchFieldRemove = (f: string) => () => {
      onFieldPropertyChange({
        ...editingField,
        searchFields: editingField.searchFields.filter(_f => _f != f),
      });
    };
    const onKeyFieldSelect = (e: ISelectOption) => {
      onFieldPropertyChange({
        ...editingField,
        keyField: e.value,
      });
    };

    /*******
     * util methods
     *******/
    const toSelectOption = (s: string): ISelectOption => ({
      text: s,
      value: s,
    });
    const isSubField = (s: string): boolean => s.includes(editingField.field);

    return (
      <Card>
        <CardTitle>{field && field.length ? field : graphqlField}</CardTitle>
        <CardDivider />
        <CardBlock>
          <FormField
            input={TextInput}
            label="Display Name"
            size="medium"
            value={editingField.displayName}
            onChange={onDisplayNameChange}
          />
        </CardBlock>
        <CardBlock>
          <Checkbox
            name="Active"
            label="Active"
            checked={editingField.isActive}
            onChange={onPropertyChange({
              property: 'isActive',
              value: !editingField.isActive,
            })}
          />
        </CardBlock>
        <CardBlock>
          <CardDivider />
          <FormField label="Key Field" />
          <Select
            size="medium"
            data={allFields.filter(isSubField).map(toSelectOption)}
            onChange={onKeyFieldSelect}
            selectedItem={
              editingField.keyField
                ? { text: editingField.keyField, value: editingField.keyField }
                : undefined
            }
          />
          <CardDivider />
          <FormField label="Search Fields" />
          <div>
            {editingField.searchFields.map(f => (
              <Grid columns={12}>
                <GridItem span={2}>
                  <Button
                    variant="danger"
                    size="small"
                    onClick={onSearchFieldRemove(f)}
                  >
                    Remove
                  </Button>
                </GridItem>
                <GridItem>
                  <Text key={f}>{f}</Text>
                </GridItem>
              </Grid>
            ))}
          </div>
          <Select
            size="medium"
            selectedItem={undefined}
            onChange={onSearchFieldAdded}
            data={allFields
              .filter(isSubField)
              .filter(f => !editingField.searchFields.includes(f))
              .map(toSelectOption)}
          />
        </CardBlock>
      </Card>
    );
  },
);
