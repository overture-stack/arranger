import { css } from '@emotion/react';
import { ResponsivePie } from '@nivo/pie';

type SunburstViewProps = {
	data: any;
	theme: any;
	colorMap: any;
	onClick: any;
};

const Legend = ({ data }: { data: { label: string; color: string }[] }) => {
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
								backgroundColor: legend.color,
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
export const SunburstView = ({ data, theme, colorMap, onClick }: SunburstViewProps) => {
	const margin = { top: 0, right: 0, bottom: 0, left: 0 };

	const padAngle = 2;

	const onMouseEnterHandler = (_, e) => {
		e.target.style.cursor = 'pointer';
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
								// @ts-ignore augmented it
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
						borderColor={{
							from: 'color',
							modifiers: [['darker', 0.2]],
						}}
						enableArcLinkLabels={false}
						enableArcLabels={false}
						padAngle={padAngle}
						onMouseEnter={onMouseEnterHandler}
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
							borderColor={{
								from: 'color',
								modifiers: [['darker', 0.2]],
							}}
							enableArcLinkLabels={false}
							enableArcLabels={false}
							padAngle={padAngle}
							onMouseEnter={onMouseEnterHandler}
						/>
					</div>
				</div>
				<Legend data={data.legend} />
			</div>
		</div>
	);
};
