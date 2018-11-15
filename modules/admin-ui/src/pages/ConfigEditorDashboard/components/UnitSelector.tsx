import * as React from 'react';
import * as convert from 'convert-units';
import Select from 'mineral-ui/Select';
import Flex from 'mineral-ui/Flex';
import Component from 'react-component-component';

export default ({
  selectedItem,
  onChange,
}: {
  selectedItem?: string | null | undefined;
  onChange?: (v: string) => void;
}) => {
  interface IOption {
    text: string;
    value: string;
  }
  interface ILocalState {
    selectedType: IOption | undefined;
  }
  interface IStateContainer {
    state: ILocalState;
    setState: (s: ILocalState) => void;
  }
  const initialState: ILocalState = {
    selectedType: selectedItem
      ? convert().describe(selectedItem).measure || undefined
      : undefined,
  };
  const unitTypeOptions: IOption[] = convert()
    .measures()
    .map((val: string): IOption => ({ text: val, value: val }));

  const onTypeSelect = (s: IStateContainer) => (option: IOption) =>
    s.setState({ ...s.state, selectedType: option });

  const getPossibleUnits = (s: IStateContainer): string[] =>
    s.state.selectedType
      ? convert().possibilities(s.state.selectedType.value)
      : [];

  const onUnitSelectionChange = (o: IOption) => {
    if (onChange) {
      onChange(o.value);
    }
  };

  return (
    <Component initialState={initialState}>
      {(s: IStateContainer) => (
        <Flex>
          <Select
            size="medium"
            placeholder="Unit type"
            selectedItem={s.state.selectedType}
            data={unitTypeOptions}
            onChange={onTypeSelect(s)}
          />
          <Select
            size="medium"
            placeholder="Unit"
            data={getPossibleUnits(s).map((val): IOption => ({
              text: val,
              value: val,
            }))}
            selectedItem={
              selectedItem && { text: selectedItem, value: selectedItem }
            }
            onChange={onUnitSelectionChange}
          />
        </Flex>
      )}
    </Component>
  );
};
