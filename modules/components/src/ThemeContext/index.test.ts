import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ThemeProvider, useThemeContext } from './index.js';

/** Renders what a component inside a provider given `theme` reads for `colors.extra`. */
const extraColourUnder = (theme?: Record<string, unknown>): string => {
	const ShowExtra = () => createElement('span', null, String((useThemeContext() as any).colors?.extra));

	return renderToStaticMarkup(createElement(ThemeProvider, { theme }, createElement(ShowExtra)));
};

describe('ThemeProvider on a page holding more than one', () => {
	it("keeps each provider's theme its own, and a key a provider stops passing reverts", () => {
		// Given a provider that sets colors.extra, rendered first
		const first = extraColourUnder({ colors: { extra: 'red' } });

		// When a second provider, setting nothing, renders afterwards
		const second = extraColourUnder();

		// Then the first sees its own key, and the second sees none of it, as the first would once it stops passing it
		expect(first).toBe('<span>red</span>');
		expect(second).toBe('<span>undefined</span>');
	});
});
