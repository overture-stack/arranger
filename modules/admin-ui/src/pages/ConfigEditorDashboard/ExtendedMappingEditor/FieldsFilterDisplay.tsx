import * as React from 'react';
import { FormField } from 'mineral-ui/Form';
import TextInput from 'mineral-ui/TextInput';
import Grid, { GridItem } from 'mineral-ui/Grid';
import Select from 'mineral-ui/Select';
import { isEqual } from 'lodash';

import { withDebouncedOnChange } from 'src/utils/';
import { ILocalState as IFilterState, EXTENDED_FIELD_TYPES } from './index';

export const BOOLEAN_FILTER_VALUES = {
  true: 'true',
  false: 'false',
};

export interface ISelectOption {
  text: string;
  value: null | string;
}

const DebouncedInput = withDebouncedOnChange()(TextInput);
const booleanFilterOptions = [
  { text: 'none', value: null },
  ...Object.values(BOOLEAN_FILTER_VALUES).map(val => ({
    text: val,
    value: val,
  })),
];
const getFieldTypeOptions = () => [
  { text: 'none', value: null },
  ...Object.values(EXTENDED_FIELD_TYPES).map(val => ({
    text: val,
    value: val,
  })),
];

// Memoized display components
const MemoizedInputFormField = React.memo(
  props => <FormField {...props} />,
  ({ value }: { value: string }, { value: newValue }: { value: string }) =>
    value === newValue,
) as typeof FormField;
const MemoizedSelectFormField = React.memo(
  props => <FormField {...props} />,
  (
    { selectedItem }: { selectedItem: ISelectOption },
    { selectedItem: newselectedItem }: { selectedItem: ISelectOption },
  ) => selectedItem === newselectedItem,
) as typeof FormField;

const FieldsFilter: React.ComponentType<{
  filterState: IFilterState;
  onFieldFilterChange: (option: React.SyntheticEvent<HTMLInputElement>) => void;
  onTypeSelect: (option: ISelectOption) => void;
  onActiveStateSelect: (option: ISelectOption) => void;
  onIsArraySelect: (option: ISelectOption) => void;
  onPrimaryStateSelect: (option: ISelectOption) => void;
  onQuicksearchEnabledSelect: (option: ISelectOption) => void;
}> = ({
  filterState,
  onFieldFilterChange,
  onTypeSelect,
  onActiveStateSelect,
  onIsArraySelect,
  onPrimaryStateSelect,
  onQuicksearchEnabledSelect,
}) => (
  <Grid alignItems="flex-end" columns={14}>
    <GridItem span={4}>
      <MemoizedInputFormField
        input={DebouncedInput}
        label="Field filter"
        value={filterState.filter.field}
        size="small"
        onChange={onFieldFilterChange}
      />
    </GridItem>
    <GridItem span={2}>
      <MemoizedSelectFormField
        input={Select}
        label="Type"
        size="small"
        selectedItem={{
          text: filterState.filter.type || '',
          value: filterState.filter.type,
        }}
        onChange={onTypeSelect}
        data={getFieldTypeOptions()}
      />
    </GridItem>
    <GridItem span={2}>
      <MemoizedSelectFormField
        input={Select}
        label="Is active"
        size="small"
        data={booleanFilterOptions}
        selectedItem={{
          text: filterState.filter.active || '',
          value: filterState.filter.active,
        }}
        onChange={onActiveStateSelect}
      />
    </GridItem>
    <GridItem span={2}>
      <MemoizedSelectFormField
        input={Select}
        label="Is array"
        size="small"
        data={booleanFilterOptions}
        selectedItem={{
          text: filterState.filter.isArray,
          value: filterState.filter.isArray,
        }}
        onChange={onIsArraySelect}
      />
    </GridItem>
    <GridItem span={2}>
      <MemoizedSelectFormField
        input={Select}
        label="Is primary key"
        size="small"
        data={booleanFilterOptions}
        selectedItem={{
          text: filterState.filter.primaryKey || '',
          value: filterState.filter.primaryKey,
        }}
        onChange={onPrimaryStateSelect}
      />
    </GridItem>
    <GridItem span={2}>
      <MemoizedSelectFormField
        input={Select}
        label="Quicksearch enabled"
        size="small"
        data={booleanFilterOptions}
        selectedItem={{
          text: filterState.filter.quickSearchEnabled || '',
          value: filterState.filter.quickSearchEnabled,
        }}
        onChange={onQuicksearchEnabledSelect}
      />
    </GridItem>
  </Grid>
);

export default React.memo(FieldsFilter, (props, nextProps) => {
  return isEqual(props.filterState, nextProps.filterState);
});
