import React, { createContext, useContext, useDebugValue, useMemo } from 'react';

import { DefaultTheme, ThemeContextInterface, ThemeProviderProps, UseThemeProps } from './types';
import { mergeOuterLocalTheme, nested } from './utils';

export const ThemeContext = createContext<ThemeContextInterface>({
  // theme: arrangerTheme as Partial<DefaultTheme>,
} as ThemeContextInterface);

if (process.env.NODE_ENV === 'development') {
  ThemeContext.displayName = 'ArrangerThemeContext';
}

export const useThemeContext = ({ customTheme }: UseThemeProps = {}): Partial<DefaultTheme> => {
  // export const useThemeContext: UseThemeFn = () => {
  const { theme } = useContext(ThemeContext);

  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useDebugValue(theme);
  }

  return theme || null;
};

export const ThemeProvider = <Theme extends DefaultTheme>({
  children,
  theme: localTheme,
}: ThemeProviderProps): React.ReactElement<ThemeContextInterface<Theme>> => {
  const outerTheme = useThemeContext();

  if (process.env.NODE_ENV === 'development') {
    // Make sure a theme is already injected higher in the tree or provide a theme object instead of a function
    if (outerTheme === null && typeof localTheme === 'function') {
      console.info(
        [
          'You are providing a theme function to the ThemeProvider:',
          '<ThemeProvider theme={outerTheme => outerTheme} />',
          '',
          'However, as no "outer theme" was given by a parent context provider, this theme provider expected a theme object instead.',
        ].join('\n'),
      );
    }
  }

  const theme = useMemo(() => {
    const output = outerTheme === null ? localTheme : mergeOuterLocalTheme(outerTheme, localTheme);

    // TODO: verify passing global vs local theme overrides vs default theme
    if (output != null) {
      output[nested] = outerTheme !== null;
    }

    return output;
  }, [localTheme, outerTheme]);

  const contextValues = {
    theme,
  };

  return <ThemeContext.Provider value={contextValues}>{children}</ThemeContext.Provider>;
};

export * as arrangerTheme from './defaultTheme';
export * from './types';
export * as themeUtils from './utils';
