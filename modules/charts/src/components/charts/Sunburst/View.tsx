import { css } from '@emotion/react';
import Color from 'color';

import { useColorMap } from '#hooks/useColorMap';
import { ResponsiveSunburst } from '@nivo/sunburst';
import { Tooltip } from '../Tooltip';
import { Legend } from './Legend';

const colorMapResolver = ({ chartData, colors }) => {
	const colorMap = new Map<string, string>();
	// used for "color wraparound" modulo
	let colorIndex = 0;

	chartData.inner.forEach(({ id, children }) => {
		const colorLookup = colorIndex++ % colors.length;
		const lighterShade = Color(colors[colorLookup]).alpha(0.5).string();

		colorMap.set(id, lighterShade);

		children.forEach((child) => {
			colorMap.set(child, Color(colors[colorLookup]).string());
		});
	});

	return colorMap;
};

type SunburstViewProps = {
	data: any;
	theme: any;
	handlers: any;
	colorMapRef: React.RefObject<Map<string, string>>;
};

/**
 * converts our segmented data to Nivo Sunburst expected
 */
const convertToHierarchy = (data) => {
	return {
		id: 'root',
		children: data.inner.map((parent, _index, arr) => ({
			id: parent.id,
			label: parent.label,
			dataValue: parent.value,
			children: data.outer
				.filter((child) => child.parentId === parent.id)
				.map((child) => ({
					id: child.id,
					label: child.label,
					// Nivo has special meaning for the "value" property, leave as duplicated for now
					dataValue: child.value,
					value: child.value,
					parentId: child.parentId,
				})),
		})),
	};
};

/**
 * Renders a responsive Nivo sunburst chart with Arranger theme integration.
 * Handles click interactions and applies consistent styling for hierarchical data.
 *
 * @param props - Sunburst chart view configuration
 * @param props.data - Transformed hierarchical chart data in Nivo format
 * @param props.theme - Arranger theme configuration
 * @param props.colorMap - Color mapping for consistent chart colors
 * @param props.onClick - Optional click handler for chart interactions
 * @returns JSX element with responsive sunburst chart
 */
export const SunburstView = ({ data, handlers, colorMapRef, maxSegments }: SunburstViewProps) => {
	// persistent color map
	const { colorMap } = useColorMap({ colorMapRef, chartData: data, resolver: colorMapResolver });

	const onClick = handlers?.onClick;

	const onMouseEnterHandler = (_, event) => {
		event.target.style.cursor = 'pointer';
	};

	// slice by maxSegments after data is resolved because the outer rings are the dynamic data
	const slicedInner = data.inner.slice(0, maxSegments);
	const outer = slicedInner
		.flatMap((parent) => parent.children)
		.map((outerId) => data.outer.find(({ id }) => id === outerId));
	const slicedData = {
		inner: slicedInner,
		outer,
		legend: data.legend.slice(0, maxSegments),
	};

	const hierarchicalData = convertToHierarchy(slicedData);

	return (
		<div css={css({ width: '100%', height: '100%' })}>
			<div
				css={css({
					display: 'flex',
					flexDirection: 'row',
					width: '100%',
					height: '100%',
				})}
			>
				<div css={css({ height: '100%', width: '70%', position: 'relative' })}>
					<ResponsiveSunburst
						data={hierarchicalData}
						cornerRadius={0}
						borderColor={{ theme: 'background' }}
						enableArcLabels={false}
						borderWidth={1}
						borderColor={'white'}
						colors={(parent) => colorMap.get(parent.id)}
						childColor={(_parent, child) => colorMap.get(child.id)}
						onMouseEnter={onMouseEnterHandler}
						tooltip={Tooltip}
						onClick={(config) => {
							if (config.data.children) {
								const ids = config.data.children.map((child) => child.id);
								onClick && onClick({ ...config, ids });
							} else {
								onClick && onClick({ ...config, ids: [config.data.label] });
							}
						}}
					/>
				</div>
				<Legend
					data={slicedData.legend}
					colorMap={colorMap}
				/>
			</div>
		</div>
	);
};
