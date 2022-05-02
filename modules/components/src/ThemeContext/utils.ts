import { merge } from 'lodash';

import { emptyObj } from '@/utils/noops';

import { ThemeProcessorFn } from './types';

// To support theme composition
const mergeTargetAndCustomTheme = <Theme>(targetTheme: Theme, customTheme: Theme) => {
  if (typeof customTheme === 'function') {
    const mergedTheme = customTheme(targetTheme);

    if (mergedTheme) {
      return mergedTheme;
    }

    const callerName = (customTheme as unknown as ThemeProcessorFn).callerName;

    if (process.env.NODE_ENV === 'development') {
      console.error(
        `Your customTheme function ${callerName ? `at ${callerName} ` : ''}should return an object`,
      );
    }

    return targetTheme;
  }

  return merge({ ...targetTheme }, customTheme);
};

export const mergeThemes = <Theme>(targetTheme: Theme, partialTheme: Theme | Theme[]) =>
  Array.isArray(partialTheme)
    ? partialTheme.reduce(
        (aggregated, partial) => mergeTargetAndCustomTheme<Theme>(aggregated, partial),
        targetTheme,
      )
    : mergeTargetAndCustomTheme<Theme>(targetTheme, partialTheme);

export const nested =
  typeof Symbol === 'function' && Symbol.for // has symbol
    ? Symbol.for('theme.nested')
    : '__THEME_NESTED__';

const getObjKeyCount = (obj = emptyObj) => Object.keys(obj).length;

const checkThemingFunction = (theme: (args?: any) => any) => {
  if (process.env.NODE_ENV === 'development') {
    typeof theme?.() === 'object' ||
      console.info(
        [
          'You are providing a theme function to the ThemeProvider:',
          '<ThemeProvider theme={outerTheme => outerTheme} />',
          '',
          'As no theme has been set, make sure the function returns a theme object.',
          'however, in this case, we recommend setting up a base theme instead',
        ].join('\n'),
      );
  }
};

export const isProviderNested = (initialTheme = emptyObj, otherThemes: any[] = [emptyObj]) => {
  const hasValidInitialTheme = getObjKeyCount(initialTheme) > 0;
  const totalValidParents = otherThemes.filter((theme = emptyObj, index) => {
    if (typeof theme === 'function') {
      // Make sure a theme is already injected higher in the tree or provide a theme object instead of a function
      return !hasValidInitialTheme && index === 0 && checkThemingFunction(theme);
    } else if (typeof theme === 'object') {
      return getObjKeyCount(theme);
    }
  }).length;

  const isNested = initialTheme ? hasValidInitialTheme && totalValidParents : totalValidParents > 1;

  return isNested && { [nested]: true };
};
