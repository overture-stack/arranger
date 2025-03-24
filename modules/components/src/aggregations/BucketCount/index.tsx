import { css } from '@emotion/react';
import cx from 'classnames';

import { useThemeContext } from '#ThemeContext/index.js';
import { emptyObj } from '#utils/noops.js';

import type Props from './types.js';

const BucketCount = ({
	className,
	children,
	css: customCSS,
	theme: {
		activeBackground: customActiveBackground,
		activeBorderColor: customActiveBorderColor,
		activeFontColor: customActiveFontColor,
		activeFontSize: customActiveFontSize,
		background,
		borderColor,
		borderRadius,
		className: customClassName,
		css: parentCSS,
		disabledBackground: customDisabledBackground,
		disabledBorderColor: customDisabledBorderColor,
		disabledFontColor: customDisabledFontColor,
		disabledFontSize: customDisabledFontSize,
		fontColor,
		fontSize,
	} = emptyObj,
	...props
}: Props) => {
	const {
		colors,
		components: {
			Aggregations: {
				BucketCount: {
					activeBackground: themeActiveBackground,
					activeBorderColor: themeActiveBorderColor,
					activeFontColor: themeActiveFontColor,
					activeFontSize: themeActiveFontSize,
					background: themeBackground = colors?.grey?.[200],
					borderColor: themeBorderColor,
					borderRadius: themeBorderRadius = '0.2rem',
					className: themeClassName,
					css: themeCSS,
					disabledBackground: themeDisabledBackground = colors?.common?.white,
					disabledBorderColor: themeDisabledBorderColor,
					disabledFontColor: themeDisabledFontColor = colors?.grey?.[700],
					disabledFontSize: themeDisabledFontSize,
					fontColor: themeFontColor = colors?.grey?.[900],
					fontSize: themeFontSize = '0.7rem',
				} = emptyObj,
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'BucketCount' });

	const hasBorder =
		borderColor ||
		themeBorderColor ||
		customActiveBorderColor ||
		themeActiveBorderColor ||
		customDisabledBorderColor ||
		themeDisabledBorderColor;

	return (
		<span
			className={cx(`bucket-count`, className, customClassName, themeClassName)}
			css={[
				themeCSS,
				css`
					background: ${background || themeBackground};
					border: ${hasBorder && '0.1rem solid transparent'};
					border-color: ${borderColor || themeBorderColor};
					border-radius: ${borderRadius || themeBorderRadius};
					color: ${fontColor || themeFontColor};
					display: inline-block;
					font-size: ${fontSize || themeFontSize};
					height: fit-content;
					padding: 0 0.2rem;

					&.active {
						background: ${customActiveBackground || themeActiveBackground};
						border-color: ${customActiveBorderColor || themeActiveBorderColor};
						color: ${customActiveFontColor || themeActiveFontColor};
						font-size: ${customActiveFontSize || themeActiveFontSize};
					}

					&.disabled {
						background: ${customDisabledBackground || themeDisabledBackground};
						border-color: ${customDisabledBorderColor || themeDisabledBorderColor};
						color: ${customDisabledFontColor || themeDisabledFontColor};
						font-size: ${customDisabledFontSize || themeDisabledFontSize};
					}
				`,
				parentCSS,
				customCSS,
			]}
			{...props}
		>
			{children}
		</span>
	);
};

export default BucketCount;
