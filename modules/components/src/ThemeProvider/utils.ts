// To support theme composition
export const mergeOuterLocalTheme = (outerTheme = {}, localTheme = {}) => {
  if (typeof localTheme === 'function') {
    const mergedTheme = localTheme(outerTheme);

    if (process.env.NODE_ENV === 'development' && mergedTheme) {
      return mergedTheme;
    }

    console.error('Your theme function should return an object');
    return outerTheme;
  }

  return { ...outerTheme, ...localTheme };
};

export const nested =
  typeof Symbol === 'function' && Symbol.for // has symbol
    ? Symbol.for('theme.nested')
    : '__THEME_NESTED__';
