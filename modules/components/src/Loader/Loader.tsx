import isPropValid from '@emotion/is-prop-valid';
import { css } from '@emotion/react';
import styled from '@emotion/styled';
import cx from 'classnames';
import color from 'color';
import { merge } from 'lodash';
import Spinkit from 'react-spinkit';

import { useThemeContext } from '@/ThemeContext';
import { emptyObj } from '@/utils/noops';

import { LoaderContainerProps, LoaderOverlayProps, LoaderProps } from './types';

const DefaultSpinner = ({ color, size }: { color?: string; size?: string | number }) => {
	return (
		<Spinkit
			fadeIn="none"
			name="circle"
			color={color}
			style={{
				width: size,
				height: size,
			}}
		/>
	);
};

const LoaderBackground = styled('div', {
	shouldForwardProp: (prop) => isPropValid(prop),
})<LoaderContainerProps>`
	border-radius: 8px;
	position: relative;
	overflow: ${({ isLoading }) => (isLoading ? 'hidden' : 'visible')};
	box-shadow: 0 1px 6px 0 rgba(0, 0, 0, 0.1), 0 1px 5px 0 rgba(0, 0, 0, 0.08);
	background-color: ${({ theme: { background } }) => background};
`;

const Loader = ({
	children,
	className = '',
	css: customCSS,
	theme: {
		color: customColor,
		Component: customComponent,
		inverted,
		size: customSize,
		vertical,
	} = emptyObj,
}: LoaderProps) => {
	const {
		colors,
		components: {
			Loader: {
				color: themeColor = colors?.grey?.[600],
				Component: themeComponent = DefaultSpinner,
				css: themeCSS,
				size: themeSize = 30,
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'Loader' });

	const spacingFromSpinner = `margin-${
		vertical ? (inverted ? 'bottom' : 'top') : inverted ? 'right' : 'left'
	}: 0.5rem;`;

	const Component = customComponent || themeComponent;

	return (
		<figure
			className={cx('Spinner', className)}
			css={[
				themeCSS,
				css`
					align-items: center;
					bottom: 0;
					display: flex;
					flex-direction: ${vertical ? 'column' : 'row'}${inverted ? '-reverse' : ''};
					justify-content: center;
					left: 0;
					margin: 0;
					position: relative;
					right: 0;
					top: 0;
				`,
				customCSS,
			]}
		>
			<Component color={customColor || themeColor} size={customSize || themeSize} />

			{children && (
				<figcaption
					css={css`
						${spacingFromSpinner}
					`}
				>
					{children}
				</figcaption>
			)}
		</figure>
	);
};

const LoaderOverlay = ({ theme: customThemeProps }: LoaderOverlayProps) => {
	const { colors, components: { LoaderOverlay: themeProps = emptyObj } = emptyObj } =
		useThemeContext({
			callerName: 'LoaderOverlay',
		});

	const theme = merge({}, themeProps, customThemeProps);

	return (
		<div
			css={css`
				position: absolute;
				left: 0px;
				right: 0px;
				top: 0px;
				bottom: 0px;
				background: ${color(colors?.common?.white).alpha(0.7).hsl().string()};
				display: flex;
				justify-content: center;
				align-items: center;
			`}
		>
			<Loader {...theme} />
		</div>
	);
};

export const LoaderContainer = ({
	children,
	className,
	disabled: customDisabled,
	isLoading = false,
	theme: {
		background: customBackground,
		borderColor: customBorderColor,
		fontColor: customFontColor,
		fontSize: customFontSize,
		lineHeight: customLineHeight,
		...customThemeProps
	} = emptyObj,
}: LoaderContainerProps) => {
	const {
		colors,
		components: {
			LoaderContainer: {
				background: themeBackground = colors?.grey?.[100],
				borderColor: themeBorderColor = colors?.grey?.[400],
				disabled: themeDisabled,
				fontColor: themeFontColor = '0.85rem',
				fontSize: themeFontSize = '0.85rem',
				lineHeight: themeLineHeight = '1.3rem',
				...themeProps
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({
		callerName: 'LoaderContainer',
	});

	const enableOverlay = !(customDisabled || themeDisabled);

	return (
		<LoaderBackground {...{ className, isLoading }}>
			{children}

			{enableOverlay && isLoading && (
				<LoaderOverlay
					theme={{
						background: customBackground || themeBackground,
						borderColor: customBorderColor || themeBorderColor,
						fontColor: customFontColor || themeFontColor,
						fontSize: customFontSize || themeFontSize,
						lineHeight: customLineHeight || themeLineHeight,
						...themeProps,
						...customThemeProps,
					}}
				/>
			)}
		</LoaderBackground>
	);
};

// const WithLoader = (Component) => {
// 	return (
// 		<Container {...loading}>
// 			<Component />
// 		</Container>
// 	);
// };

export default Loader;
