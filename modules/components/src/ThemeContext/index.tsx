import {
  ComponentType,
  createContext,
  ReactElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { isEqual, omit } from 'lodash';

import getComponentDisplayName from '@/utils/getComponentDisplayName';
import missingProviderHandler from '@/utils/missingProvider';
import noopFn, { emptyObj } from '@/utils/noops';

import arrangerBaseTheme from './baseTheme';
import {
  BaseThemeInterface,
  CustomThemeType,
  ThemeAggregatorFn,
  ThemeContextInterface,
  ThemeOptions,
  ThemeProcessorFn,
  ThemeProviderProps,
  UseThemeContextProps,
  WithThemeProps,
} from './types';
import { isProviderNested, mergeThemes } from './utils';

export const ThemeContext = createContext<ThemeContextInterface<ThemeOptions>>({
  providerMissing: true,
  theme: {},
} as ThemeContextInterface<ThemeOptions>);

/** hook for theme access and aggregation
 * @param {Theme} [customTheme] takes customisation parameters for Arranger components.
 * @returns {Theme} theme object
 */
export const useThemeContext = (customTheme: UseThemeContextProps = emptyObj): ThemeOptions => {
  const { aggregateTheme = noopFn, providerMissing, theme } = useContext(ThemeContext);

  useEffect(() => {
    aggregateTheme(
      typeof customTheme === 'function' ? customTheme : omit(customTheme, 'callerName'),
    );
  }, [aggregateTheme, customTheme, theme]);

  providerMissing && missingProviderHandler(ThemeContext.displayName, customTheme.callerName);

  return useMemo(() => theme, [theme]);
};

const useAggregableTheme = (initialTheme: any): readonly [ThemeOptions, ThemeAggregatorFn] => {
  const [currentTheme, setCurrentTheme] = useState<ThemeOptions>(initialTheme);

  const aggregateTheme = useCallback<ThemeAggregatorFn>(
    (partialTheme) => {
      const theme = partialTheme
        ? mergeThemes<CustomThemeType<ThemeOptions>>(currentTheme, partialTheme)
        : currentTheme;

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
 * @param {Theme} [theme] allows giving the provider a custom version of the theme for the consumers.
 * @param {boolean} [useArrangerTheme=true] tells the provider to source the default Arranger theme. (optional, default: `true`)
 */
export const ThemeProvider = <Theme extends BaseThemeInterface>({
  children,
  theme: localTheme,
  useArrangerTheme = true,
}: ThemeProviderProps): ReactElement<ThemeContextInterface<Theme>> => {
  const outerTheme = useThemeContext({ callerName: ThemeContext.displayName }); // get theme from parent theme provider, if any.
  const initialTheme = useArrangerTheme ? arrangerBaseTheme : emptyObj;
  const isNested = isProviderNested(initialTheme, [outerTheme, localTheme]);
  const otherThemes = [outerTheme, localTheme, isNested];

  const [theme, aggregateTheme] = useAggregableTheme(mergeThemes(initialTheme, otherThemes));

  const contextValues = {
    aggregateTheme,
    theme,
  };

  return <ThemeContext.Provider value={contextValues}>{children}</ThemeContext.Provider>;
};

/** HOC for theme access
 * @param {ComponentType} Component the component you want to provide Arranger data to.
 * @returns {Theme} theme object
 */
export const withTheme = <Props extends object>(Component: ComponentType<Props>) => {
  const callerName = getComponentDisplayName(Component);
  const ThemedComponent = ({ theme: customTheme, ...props }: WithThemeProps<ThemeOptions>) => {
    if (typeof customTheme === 'function') {
      (customTheme as ThemeProcessorFn).callerName = callerName;
    }
    const theme = useThemeContext(customTheme || { callerName });

    const themedProps = {
      ...props,
      theme,
    } as Props;

    return <Component {...themedProps} />;
  };

  ThemedComponent.displayName = `WithArrangerTheme(${callerName})`;

  return ThemedComponent;
};

if (process.env.NODE_ENV === 'development') {
  ThemeContext.displayName = 'ArrangerThemeContext';
  ThemeProvider.displayName = 'ArrangerThemeProvider';
}

export * as arrangerTheme from './baseTheme';
export * as themeUtils from './utils';
