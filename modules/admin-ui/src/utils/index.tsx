import * as React from 'react';
import Component from 'react-component-component';
import { debounce } from 'lodash';

export type THoc<TInner, TOuter> = (
  InputCompoent: React.ComponentType<TInner & TOuter>,
) => React.ComponentType<TInner>;

export const readFile = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    var reader = new FileReader();
    reader.readAsText(file, 'UTF-8');
    reader.onload = function(evt: any) {
      resolve(evt.target.result);
    };
    reader.onerror = function(evt) {
      reject();
    };
  });

export const withDebouncedOnChange = ({
  debounceTime = 500,
}: {
  debounceTime?: number;
} = {}) => Input => ({ value, onChange, ...props }) => {
  interface ILocalState {
    value: string;
  }
  interface IStateContainer {
    state: ILocalState;
    setState: (s: ILocalState) => void;
  }

  const debouncedOnchange = debounce(
    (e: React.SyntheticEvent<HTMLInputElement>) => {
      e.currentTarget = e.target as HTMLInputElement;
      onChange(e);
    },
    debounceTime,
  );

  const whenInputChange = (s: IStateContainer) => (
    e: React.SyntheticEvent<HTMLInputElement>,
  ) => {
    e.persist();
    s.setState({ value: e.currentTarget.value });
    debouncedOnchange(e);
  };

  return (
    <Component initialState={{ value: value }}>
      {(s: IStateContainer) => (
        <Input value={s.state.value} onChange={whenInputChange(s)} {...props} />
      )}
    </Component>
  );
};
