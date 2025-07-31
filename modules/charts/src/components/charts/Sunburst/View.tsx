import { css } from '@emotion/react';
import { ResponsivePie } from '@nivo/pie';
import { Legend } from './Legend';

const margin = { top: 0, right: 0, bottom: 0, left: 0 };

const padAngle = 2;

const onMouseEnterHandler = (_, e) => {
	e.target.style.cursor = 'pointer';
};

const SunburstDisplay = ({ data, config }) => {
	return (
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
					colors={{ datum: 'data.color' }}
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
						opacity: 0.5,
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
						colors={{ datum: 'data.color' }}
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
	);
};
