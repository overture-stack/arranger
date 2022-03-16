import {
  ComponentType,
  createContext,
  ReactElement,
  useCallback,
  useContext,
  useDebugValue,
  useEffect,
  useState,
} from 'react';
import { isEqual } from 'lodash';

import getComponentDisplayName from '@/utils/getComponentDisplayName';
import noopFn from '@/utils/noopFns';

import arrangerTheme from './defaultTheme';
import {
  CustomThemeType,
  DefaultTheme,
  ThemeAggregatorFn,
  ThemeContextInterface,
  ThemeOptions,
  ThemeProviderProps,
  WithThemeProps,
} from './types';
import { isProviderNested, mergeThemes } from './utils';

export const ThemeContext = createContext<ThemeContextInterface<ThemeOptions>>(
  {} as ThemeContextInterface<ThemeOptions>,
);

export const useThemeContext = (customTheme?: CustomThemeType<ThemeOptions>): ThemeOptions => {
  const { theme, aggregateTheme = noopFn } = useContext(ThemeContext);

  useEffect(() => {
    customTheme && aggregateTheme(customTheme);
  }, [aggregateTheme, customTheme, theme]);

  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useDebugValue(theme);
  }

  return theme;
};

// const useAggregableTheme = (initialTheme?: CustomThemeType | CustomThemeType[]) => {
const useAggregableTheme = (initialTheme: any): readonly [ThemeOptions, ThemeAggregatorFn] => {
  const [currentTheme, setCurrentTheme] = useState<ThemeOptions>(initialTheme);

  const aggregateTheme = useCallback<ThemeAggregatorFn>(
    (partialTheme) => {
      const theme = partialTheme ? mergeThemes(currentTheme, partialTheme) : currentTheme;

      if (!isEqual(JSON.stringify(currentTheme), JSON.stringify(theme))) {
        setCurrentTheme(theme);
      }

      return theme;
    },
    [currentTheme],
  );

  return [currentTheme, aggregateTheme] as const; // make tuple type
};

/** Context provider for Arranger's theme functionalities
 * @param {Theme} theme allows giving the provider a custom version of the theme for the consumers.
 * @param {boolean} useArrangerTheme tells the provider to source the default Arranger theme. (default: `true`)
 */
export const ThemeProvider = <Theme extends DefaultTheme>({
  children,
  theme: localTheme,
  useArrangerTheme = true,
}: ThemeProviderProps): ReactElement<ThemeContextInterface<Theme>> => {
  const outerTheme = useThemeContext(); // get theme from parent theme provider, if any.
  const defaultTheme = useArrangerTheme ? arrangerTheme : {};
  const isNested = isProviderNested(defaultTheme, [outerTheme, localTheme]);
  const otherThemes = [outerTheme, localTheme, isNested];

  const [theme, aggregateTheme] = useAggregableTheme(mergeThemes(defaultTheme, otherThemes));

  const contextValues = {
    aggregateTheme,
    theme,
  };

  return <ThemeContext.Provider value={contextValues}>{children}</ThemeContext.Provider>;
};

export const withTheme = <Props extends object>(Component: ComponentType<Props>) => {
  const ThemedComponent = ({ theme: customTheme, ...props }: WithThemeProps<ThemeOptions>) => {
    const themedProps = {
      ...props,
      theme: useThemeContext(customTheme),
    } as Props;

    return <Component {...themedProps} />;
  };

  ThemedComponent.displayName = `WithArrangerTheme(${getComponentDisplayName(Component)})`;

  return ThemedComponent;
};

if (process.env.NODE_ENV === 'development') {
  ThemeContext.displayName = 'ArrangerThemeContext';
  ThemeProvider.displayName = 'ArrangerThemeProvider';
}

export * as arrangerTheme from './defaultTheme';
export * from './types';
export * as themeUtils from './utils';
