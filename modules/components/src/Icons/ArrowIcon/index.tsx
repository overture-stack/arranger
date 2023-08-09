import { css } from '@emotion/react';
import cx from 'classnames';

import { useThemeContext } from '@/ThemeContext';
import { emptyObj } from '@/utils/noops';

import Props from './types';

/** Displays a chevron, commonly used for dropdown functionalities (buttons and trees)
 * The following props (passed by the parent components) will be prioritised over theme customisations
 * @param {string} fill override the default hue
 * @param {boolean} isTreeJoint makes the arrow point right when not pointing down
 * @param {boolean} pointUp tells the arrow to point up rather than down/right
 * @param {number|size} size specifies the magnitude of the arrow
 * @param {string} transition css animation speed
 **/

const ArrowIcon = ({
	className,
	css: customCSS,
	disabled,
	disabledFill,
	fill,
	isTreeJoint,
	pointUp,
	size,
	transition,
}: Props) => {
	const {
		colors,
		components: {
			ArrowIcon: {
				className: themeClassName,
				css: themeCSS,
				disabledFill: themeDisabledFill = colors?.grey?.[400],
				fill: themeFill = colors?.grey?.[600],
				size: themeSize = 12,
				transition: themeTransition = 'all 0.2s',
				...themeArrowIconProps
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'ArrowIcon' });

	return (
		<svg
			className={cx('arrow', className, themeClassName)}
			css={[
				themeCSS,
				css`
					flex: 0 auto;
					transform: ${isTreeJoint
						? pointUp
							? undefined
							: 'rotate(-90deg)'
						: pointUp
						? 'scale(-1)'
						: undefined};
					transition: ${transition || themeTransition};
				`,
				customCSS,
			]}
			height={size || themeSize}
			preserveAspectRatio="xMidYMin "
			viewBox="0 0 12 12"
			width={size || themeSize}
			{...themeArrowIconProps}
		>
			<path
				fill={disabled ? disabledFill || themeDisabledFill : fill || themeFill}
				d="M9.952 3.342c.468-.456 1.228-.456 1.697 0 .234.228.351.526.351.825 0
      .298-.117.597-.351.825l-4.8 4.666c-.469.456-1.23.456-1.697 0l-4.8-4.666c-.47-.456-.47-1.194
      0-1.65.468-.456 1.228-.456 1.696 0L6 7.184l3.952-3.842z"
			/>
		</svg>
	);
};

export default ArrowIcon;
