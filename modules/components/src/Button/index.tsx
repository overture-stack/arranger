import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';
import Color from 'color';
import { createRef, type ForwardedRef, forwardRef, type MouseEventHandler } from 'react';

import { useThemeContext } from '#ThemeContext/index.js';
import { withTooltip } from '#Tooltip/index.js';
import noopFn, { emptyObj } from '#utils/noops.js';

import type { ButtonProps } from './types.js';

const BaseButton = withTooltip(styled('button', {
	shouldForwardProp: isPropValid,
})<ButtonProps>`
	align-items: center;
	background: ${({ theme: { background } }) => background};
	box-sizing: border-box;
	border: ${({ theme: { borderColor } }) => borderColor && `0.08rem solid ${borderColor}`};
	border-radius: ${({ theme: { borderRadius } }) => borderRadius};
	color: ${({ theme: { fontColor } }) => fontColor};
	cursor: ${({ onClick }) => (typeof onClick === 'function' ? 'pointer' : 'default')};
	display: flex;
	flex: ${({ theme: { flex } }) => flex};
	font-family: ${({ theme: { fontFamily } }) => fontFamily};
	font-size: ${({ theme: { fontSize } }) => fontSize};
	font-weight: ${({ theme: { fontWeight } }) => fontWeight};
	height: ${({ theme: { height } }) => height};
	justify-content: center;
	letter-spacing: ${({ theme: { letterSpacing } }) => letterSpacing};
	line-height: ${({ theme: { lineHeight } }) => lineHeight};
	margin: ${({ theme: { margin } }) => margin};
	padding: ${({ theme: { padding } }) => padding};
	pointer-events: ${({ hidden }) => hidden && 'none'};
	position: ${({ theme: { position = 'relative' } }) => position};
	text-transform: ${({ theme: { textTransform } }) => textTransform};
	visibility: ${({ hidden }) => hidden && 'hidden'};
	white-space: ${({ theme: { whiteSpace } }) => whiteSpace};
	width: ${({ theme: { width } }) => width};

	&:not(.disabled):not(:disabled):hover {
		background: ${({ theme: { hoverBackground } }) => hoverBackground};
	}

	&.disabled,
	&:disabled {
		background: ${({ theme: { disabledBackground } }) => disabledBackground};
		border: ${({ theme: { disabledBorderColor } }) => disabledBorderColor && `0.08rem solid ${disabledBorderColor}`};
		color: ${({ theme: { disabledFontColor } }) => disabledFontColor};
		cursor: not-allowed;
	}
`);

const propagationStopper =
	(clickHandler = noopFn): MouseEventHandler =>
	(event) => {
		event.stopPropagation();
		clickHandler?.(event);
	};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	(
		{
			children,
			theme: {
				background: customBackground,
				borderColor: customBorderColor,
				borderRadius: customBorderRadius,
				disabledBackground: customDisabledBackground,
				disabledBorderColor: customDisabledBorderColor,
				disabledFontColor: customDisabledFontColor,
				fontColor: customFontColor,
				fontSize: customFontSize,
				lineHeight: customLineHeight,
				...customThemeProps
			} = emptyObj,
			onClick,
			...props
		},
		ref?: ForwardedRef<HTMLButtonElement>,
	) => {
		// manual displayname setting required due to forwardRef
		Button.displayName = 'Button';

		const forwardedRef = ref || createRef();

		const {
			colors,
			components: {
				Button: {
					background: themeBackground = colors?.grey?.[100],
					borderColor: themeBorderColor = colors?.grey?.[400],
					borderRadius: themeBorderRadius = '0.3rem',
					disabledBackground: themeDisabledBackground = colors?.grey?.[100],
					disabledBorderColor: themeDisabledBorderColor = colors?.grey?.[300],
					disabledFontColor: themeDisabledFontColor = colors?.grey?.[300],
					fontColor: themeFontColor = '0.85rem',
					fontSize: themeFontSize = '0.85rem',
					lineHeight: themeLineHeight = '1.3rem',
					...themeProps
				} = emptyObj,
			} = emptyObj,
		} = useThemeContext({
			callerName: 'Button',
		});

		return (
			<BaseButton
				theme={{
					background: customBackground || themeBackground,
					borderColor: customBorderColor || themeBorderColor,
					borderRadius: customBorderRadius || themeBorderRadius,
					disabledBackground: customDisabledBackground || themeDisabledBackground,
					disabledBorderColor: customDisabledBorderColor || themeDisabledBorderColor,
					disabledFontColor: customDisabledFontColor || themeDisabledFontColor,
					fontColor: customFontColor || themeFontColor,
					fontSize: customFontSize || themeFontSize,
					lineHeight: customLineHeight || themeLineHeight,
					...themeProps,
					...customThemeProps,
				}}
				onClick={propagationStopper(onClick)}
				ref={forwardedRef}
				{...props}
			>
				{children}
			</BaseButton>
		);
	},
);

const TransparentButtonBase = styled(BaseButton)<ButtonProps>`
	background: ${({ theme: { background = 'none' } }) => background};
	border: ${({ theme: { borderColor } }) => (borderColor ? `0.1rem solid ${borderColor}` : 'none')};
	color: ${({ theme: { fontColor = 'inherit' } }) => fontColor};
	font-family: ${({ theme: { fontFamily = 'inherit' } }) => fontFamily};
	justify-content: flex-start;
	margin: ${({ theme: { margin = 0 } }) => margin};
	padding: ${({ theme: { padding = 0 } }) => padding};
	text-align: left;

	&:focus,
	&:hover {
		color: ${({ theme: { hoverFontColor, fontColor } }) =>
			hoverFontColor || (fontColor && fontColor !== 'inherit' && Color(fontColor).lighten(0.3).string())};
	}
`;

export const TransparentButton = ({
	onClick,
	theme: { css: themeCSS, ...theme } = emptyObj,
	...props
}: {
	onClick?: MouseEventHandler<HTMLButtonElement>;
} & ButtonProps) => {
	return <TransparentButtonBase onClick={propagationStopper(onClick)} css={themeCSS} theme={theme} {...props} />;
};

export default Button;
