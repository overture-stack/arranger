import React from 'react';

import ThemeSwitcher, { AVAILABLE_THEMES } from '#ThemeSwitcher/index.js';

export const themeDecorator = (story) => (
	<>
		<ThemeSwitcher availableThemes={AVAILABLE_THEMES} />
		{story()}
	</>
);
