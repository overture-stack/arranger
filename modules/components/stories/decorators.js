import React from 'react';
import ThemeSwitcher, { AVAILABLE_THEMES } from '../src/ThemeSwitcher';

export const themeDecorator = story => (
  <>
    <ThemeSwitcher availableThemes={AVAILABLE_THEMES} />
    {story()}
  </>
);
