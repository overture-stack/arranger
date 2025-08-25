import { ComponentType, createContext, PropsWithChildren, useContext } from 'react';

const defaultColors = [
	// https://observablehq.com/@d3/color-schemes?collection=@d3/d3-scale-chromatic
	'#a6cee3',
	'#1f78b4',
	'#b2df8a',
	'#33a02c',
	'#fb9a99',
	'#e31a1c',
	'#fdbf6f',
	'#ff7f00',
	'#cab2d6',
	'#6a3d9a',
	'#ffff99',
	'#b15928',
];

interface ThemeProviderProps {
	colors?: string[];
	components?: {
		TooltipComp?: ComponentType;
		Loader?: ComponentType;
		ErrorData?: ComponentType;
		EmptyData?: ComponentType;
	};
}

export const ThemeContext = createContext<ThemeProviderProps | null>(null);

/**
 * Provider to supply theme configuration to all child chart components.
 *
 * @param props - The theme configuration and children
 * @param props.children - Child components that will have access to the theme context (charts)
 * @param props.colors - Optional array of color values for chart theming used by color resolvers
 * @param props.components - Optional custom components to override defaults
 *
 * @returns JSX element that provides theme context to children
 */
export const ChartsThemeProvider = ({ children, ...props }: PropsWithChildren<ThemeProviderProps>) => {
	return <ThemeContext.Provider value={{ colors: defaultColors, ...props }}>{children}</ThemeContext.Provider>;
};

export const useThemeContext = () => {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error('ThemeContext has to be used within a <ChartsThemeProvider>');
	}
	return context;
};
