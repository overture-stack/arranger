import * as React from 'react';
import { Theme } from './types';
import { THoc } from '../utils';

const theme: Theme = {
  colors: {
    primary: '#a72696',
    white: 'white',
  },
  unit: 12,
  fonts: { primary: 'Helvetica' },
};

interface WithThemeProps {
  theme: Theme;
}

export type TWithThemeHoc<P = any> = THoc<P, WithThemeProps>;

export type TComponentWithTheme<P = {}> = React.ComponentType<
  P & { theme: Theme }
>;

export const withTheme: TWithThemeHoc = Wrapped => {
  return props => {
    return <Wrapped {...{ ...props, theme }} />;
  };
};
export { Theme } from './types';
