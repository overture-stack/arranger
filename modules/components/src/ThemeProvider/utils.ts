import { merge } from 'lodash';

// To support theme composition
const mergeBaseAndCustomTheme = (baseTheme = {}, customTheme = {}) => {
  if (typeof customTheme === 'function') {
    const mergedTheme = customTheme(baseTheme);

    if (mergedTheme) {
      return mergedTheme;
    }

    if (process.env.NODE_ENV === 'development') {
      console.error('Your customTheme function should return an object');
    }

    return baseTheme;
  }

  return merge({ ...baseTheme }, customTheme);
};

export const mergeThemes = (baseTheme = {}, partialTheme = {}) =>
  Array.isArray(partialTheme)
    ? partialTheme.reduce(
        (aggregated, partial) => mergeBaseAndCustomTheme(aggregated, partial),
        baseTheme,
      )
    : mergeBaseAndCustomTheme(baseTheme, partialTheme);

export const nested =
  typeof Symbol === 'function' && Symbol.for // has symbol
    ? Symbol.for('theme.nested')
    : '__THEME_NESTED__';

const getObjKeyCount = (obj = {}) => Object.keys(obj).length;

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

export const isProviderNested = (defaultTheme = {}, otherThemes: any[] = [{}]) => {
  const hasValidDefaultTheme = getObjKeyCount(defaultTheme) > 0;
  const totalValidParents = otherThemes.filter((theme = {}, index) => {
    if (typeof theme === 'function') {
      // Make sure a theme is already injected higher in the tree or provide a theme object instead of a function
      return !hasValidDefaultTheme && index === 0 && checkThemingFunction(theme);
    } else if (typeof theme === 'object') {
      return getObjKeyCount(theme);
    }
  }).length;

  const isNested = defaultTheme ? hasValidDefaultTheme && totalValidParents : totalValidParents > 1;

  return isNested && { [nested]: true };
};
