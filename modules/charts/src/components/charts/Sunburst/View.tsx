import { css } from '@emotion/react';
import { ResponsivePie } from '@nivo/pie';
import Color from 'color';

import { Tooltip } from '#components/charts/Tooltip';
import { useColorMap } from '#hooks/useColorMap';

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

const Legend = ({ data, colorMap }: { data: { label: string }[] }) => {
	return (
		<div
			css={css({
				display: 'flex',
				flexDirection: 'column',
				flexWrap: 'wrap',
				columnGap: '8px',
				'> div': { marginTop: '16px' },
			})}
		>
			{data.map((legend, index) => {
				return (
					<div
						css={css({ display: 'flex', flexDirection: 'row', alignItems: 'center' })}
						key={`${legend.label}_${index}`}
					>
						<div
							css={css({
								width: '12px',
								height: '12px',
								backgroundColor: colorMap.get(legend.label) || 'black',
								marginRight: '8px',
							})}
						/>
						<span css={css({ fontSize: '10px', fontWeight: 400 })}>{legend.label}</span>
					</div>
				);
			})}
		</div>
	);
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
export const SunburstView = ({ data, handlers, colorMapRef }: SunburstViewProps) => {
	// persistent color map
	const { colorMap } = useColorMap({ colorMapRef, chartData: data, resolver: colorMapResolver });

	const onClick = handlers?.onClick;

	const margin = { top: 0, right: 0, bottom: 0, left: 0 };

	const padAngle = 2;

	const onMouseEnterHandler = (_, event) => {
		event.target.style.cursor = 'pointer';
	};

	const borderColor = (segment) => {
		return Color(colorMap.get(segment.id)).lighten(0.075).string();
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
							const allCodes = data.outer
								.filter((outerRing) => outerRing.parentId === config.data.parentId)
								.map((code) => code.id);
							onClick && onClick({ ...config, allCodes });
						}}
						colors={data.outer.map((node) => colorMap.get(node.id))}
						data={data.outer}
						isInteractive={true}
						margin={margin}
						innerRadius={0.75}
						activeOuterRadiusOffset={0}
						borderWidth={1}
						borderColor={borderColor}
						enableArcLinkLabels={false}
						enableArcLabels={false}
						padAngle={padAngle}
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
							colors={data.inner.map((node) => colorMap.get(node.id))}
							data={data.inner}
							isInteractive={true}
							innerRadius={0.75}
							activeOuterRadiusOffset={0}
							borderWidth={1}
							borderColor={borderColor}
							enableArcLinkLabels={false}
							enableArcLabels={false}
							padAngle={padAngle}
							onMouseEnter={onMouseEnterHandler}
							tooltip={Tooltip}
						/>
					</div>
				</div>
				<Legend
					data={data.legend}
					colorMap={colorMap}
				/>
			</div>
		</div>
	);
};
