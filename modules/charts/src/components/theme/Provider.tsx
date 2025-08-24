import { ComponentType, createContext, PropsWithChildren, useContext } from 'react';

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
	return <ThemeContext.Provider value={props}>{children}</ThemeContext.Provider>;
};

export const useThemeContext = () => {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error('ThemeContext has to be used within a <ChartsThemeProvider>');
	}
	return context;
};
