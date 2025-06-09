import { useEffect, useRef } from 'react';
import { useChartsContext } from './Provider';
import { ChartContainer } from './ChartContainer';
import { zip, isEmpty, get } from 'lodash';
import { ArrangerChartProps, ArrangerChartTheme } from '../theme/arranger';
import { useColors } from '../hooks/useColors';

type ChartProps = {
	fieldName: string;
	theme: ArrangerChartTheme;
	headless?: boolean;
	children?: React.ReactElement;
	DisplayComponent?: React.ReactElement<ArrangerChartProps>;
};

// Container => Comp
/**
 * anything that needs access to data in here
 * @param param0
 * @returns
 */
export const Chart = ({ fieldName, theme, children, headless, DisplayComponent }: ChartProps) => {
	const { registerChart, deregisterChart, getChartData } = useChartsContext();

	useEffect(() => {
		try {
			registerChart({ fieldName });
		} catch (e) {
			console.error(`Cannot register chart ${fieldName} with Arranger Charts provider.`);
			console.error(e);
		}
		return () => {
			deregisterChart({ fieldName });
		};
	}, []);

	const data = getChartData({ fieldName });

	// headless
	if (headless) {
		if (typeof children === 'function') {
			return children({ data });
		}
		console.error('Arranger Charts Headless component needs a function as children to render.');
	}

	// TODO: memoize, data changes but not config
	// using cloneDeep because structuredClone needs window obj, not SSR compatible
	const resolvedConfig = merge(cloneDeep(defaultConfig), config, {
		theme,
	});

	// keep colors hash between renders eg. loading states between queries
	const barchartData = get(data.data, 'buckets', {});
	const colors = useColors({
		keys: barchartData,
		theme: colourTheme,
	});

	// child component
	if (data.isLoading) {
		return <div> Loading</div>;
	} else if (data.isError) {
		return <div> Error</div>;
	} else if (data.data === undefined) {
		return <div> no data</div>;
	} else {
		return (
			<ChartContainer>
				<DisplayComponent
					data={data.data}
					config={{ ...config, colors: colors.getColors }}
				/>
			</ChartContainer>
		);
	}
};
