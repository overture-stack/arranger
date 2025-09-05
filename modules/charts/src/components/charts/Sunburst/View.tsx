import { css } from '@emotion/react';
import { ResponsivePie } from '@nivo/pie';
import Color from 'color';

import { Tooltip } from '#components/charts/Tooltip';
import { useColorMap } from '#hooks/useColorMap';
import { Legend } from './Legend';

const colorMapResolver = ({ chartData, colors }) => {
	const colorMap = new Map<string, string>();
	// used for "color wraparound" modulo
	let colorIndex = 0;

	chartData.inner.forEach(({ id, children }) => {
		const color = Color(colors[colorIndex++ % colors.length]);
		colorMap.set(id, color.alpha(0.5).hsl().string());
		children.forEach((child) => {
			colorMap.set(child, color.string());
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

	const margin = { top: 0, right: 0, bottom: 0, left: 0 };

	// spacing between segments (that's how we're using it)
	const borderWidth = 4;

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

	return (
		<div css={css({ width: '100%', height: '100%' })}>
			<div
				css={css({
					display: 'flex',
					flexDirection: 'row',
					width: '100%',
					height: '100%',
					pointerEvents: 'none',

					// prevent overlapping of elements from obstructing "path:hover"
					path: {
						pointerEvents: 'auto',
					},
				})}
			>
				<div css={css({ height: '100%', width: '70%', position: 'relative' })}>
					<ResponsivePie
						onClick={(config) => {
							const allCodes = slicedData.outer
								.filter((outerRing) => outerRing.parentId === config.data.parentId)
								.map((code) => code.id);
							onClick && onClick({ ...config, allCodes });
						}}
						colors={slicedData.outer.map((node) => colorMap.get(node.id))}
						data={slicedData.outer}
						isInteractive={true}
						margin={margin}
						innerRadius={0.75}
						activeOuterRadiusOffset={0}
						borderWidth={borderWidth}
						borderColor={'#fff'}
						enableArcLinkLabels={false}
						enableArcLabels={false}
						onMouseEnter={onMouseEnterHandler}
						tooltip={Tooltip}
					/>
					<div
						className="inner"
						css={css({
							position: 'absolute',
							height: '60%',
							width: '60%',
							// set center to halfway across parent container
							top: '50%',
							left: '50%',
							// change origin to centered by moving it back half it's own width + height
							transform: 'translate(-50%,-50%)',
						})}
					>
						<ResponsivePie
							onClick={(config) => {
								onClick && onClick(config);
							}}
							colors={slicedData.inner.map((node) => colorMap.get(node.id))}
							data={slicedData.inner}
							isInteractive={true}
							innerRadius={0.75}
							activeOuterRadiusOffset={0}
							borderWidth={borderWidth}
							borderColor={'#fff'}
							enableArcLinkLabels={false}
							enableArcLabels={false}
							onMouseEnter={onMouseEnterHandler}
							tooltip={Tooltip}
						/>
					</div>
				</div>
				<Legend
					data={slicedData.legend}
					colorMap={colorMap}
				/>
			</div>
		</div>
	);
};
