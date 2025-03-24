import isPropValid from '@emotion/is-prop-valid';
import { css } from '@emotion/react';
import styled from '@emotion/styled';
import cx from 'classnames';
import { format } from 'date-fns';
import { merge, truncate, xor } from 'lodash-es';
import { useCallback, useState } from 'react';

import { TransparentButton } from '#Button/index.js';
import type { ButtonProps } from '#Button/types.js';
import { useDataContext } from '#DataContext/index.js';
import { Row } from '#Flex/index.js';
import { useThemeContext } from '#ThemeContext/index.js';
import type { ThemeCommon } from '#ThemeContext/types/index.js';
import { emptyObj } from '#utils/noops.js';
import internalTranslateSQONValue from '#utils/translateSQONValue.js';

import type {
	GroupSQONInterface,
	GroupValueSQONType,
	SQONViewerThemeProps,
	UseDataBubblesProps,
	ValueSQONInterface,
} from './types.js';

export interface BubbleProps extends ButtonProps {
	onClick?: () => void;
}

export const Bubble = ({ children, className, theme, ...props }: BubbleProps) => {
	const { components: { SQONViewer: { SQONBubble: themeSQONBubbleProps = emptyObj } = emptyObj } = emptyObj } =
		useThemeContext({ callerName: 'SQONViewer - Bubble' });

	return (
		<TransparentButton
			className={cx('sqon-bubble', className)}
			css={css``}
			theme={merge(
				{
					margin: '0 0.2em',
				},
				themeSQONBubbleProps,
				theme,
			)}
			{...props}
		>
			{children}
		</TransparentButton>
	);
};

export const FieldName = ({ children, className, css: customCSS, ...props }: BubbleProps) => (
	<Bubble
		className={cx('sqon-fieldName', className)}
		css={[
			css`
				cursor: default;
			`,
			customCSS,
		]}
		{...props}
	>
		{children}
	</Bubble>
);

export const Op = ({ children, className, css: customCSS, ...props }: BubbleProps) => (
	<Bubble
		className={cx('sqon-op', className)}
		css={[
			css`
				cursor: default;
			`,
			customCSS,
		]}
		{...props}
	>
		{children}
	</Bubble>
);

export const Value = ({ children, className, ...props }: BubbleProps) => (
	<Bubble className={cx('sqon-value', className)} {...props}>
		{children}
	</Bubble>
);

/** Creates the components dynamically, based on data
 * provided by the Server configs' extended mapping.
 */
export const useDataBubbles = ({
	dateFormat = 'yyyy-MM-dd',
	onClear,
	setSQON,
	translateSQONValue = (x) => x,
	valueCharacterLimit,
}: UseDataBubblesProps) => {
	const {
		colors,
		components: {
			SQONViewer: {
				SQONClear: { label: themeSQONClearLabel = 'Clear', ...themeSQONClearProps } = emptyObj,
				SQONFieldName: themeSQONFieldNameProps = emptyObj,
				SQONLessOrMore: themeSQONLessOrMoreProps = emptyObj,
				SQONValue: {
					characterLimit: themeCharacterLimit = 30,
					css: themeSQONValueCustomCSS = emptyObj,
					...themeSQONValueProps
				} = emptyObj,
			} = emptyObj,
		} = emptyObj,
	} = useThemeContext({ callerName: 'SQONViewer - useDataBubbles' });
	const [expanded, setExpanded] = useState<GroupValueSQONType>([]);

	const isExpanded = useCallback((valueSQON: ValueSQONInterface) => expanded.includes(valueSQON), [expanded]);

	const { extendedMapping } = useDataContext({ callerName: 'SQONViewer - useDataBubbles' });
	const findExtendedMappingForField = useCallback(
		(wantedFieldName: string) => extendedMapping.find((mapping) => mapping.fieldName === wantedFieldName),
		[extendedMapping],
	);

	const Clear = ({ nextSQON }: { nextSQON: GroupSQONInterface | null }) => (
		<Bubble
			className="sqon-clear"
			css={css`
				margin-left: 0;
				margin-right: 0.5em;
			`}
			onClick={() => {
				onClear?.();
				setSQON?.(nextSQON);
			}}
			theme={{
				background: colors?.grey?.[200],
				borderRadius: '0.3em',
				disabledBackground: colors?.grey?.[100],
				hoverBackground: colors?.grey?.[300],
				padding: '0.2em 0.5em',
				...themeSQONClearProps,
			}}
		>
			{themeSQONClearLabel}
		</Bubble>
	);

	const FieldNameCrumb = ({ fieldName, ...fieldProps }: { fieldName: string }) => (
		<FieldName css={css``} theme={{ fontWeight: 'bold', ...themeSQONFieldNameProps }} {...{ fieldName, ...fieldProps }}>
			{findExtendedMappingForField(fieldName)?.displayName || fieldName}
		</FieldName>
	);

	const lessOrMoreClickHandler = useCallback(
		(valueSQON: ValueSQONInterface) => () => setExpanded(xor(expanded, [valueSQON])),
		[expanded],
	);

	const LessOrMore = ({ valueSQON }: { valueSQON: ValueSQONInterface }) => {
		const showLess = isExpanded(valueSQON);

		return (
			<Bubble
				className={cx(showLess ? 'sqon-less' : 'sqon-more')}
				onClick={lessOrMoreClickHandler(valueSQON)}
				theme={themeSQONLessOrMoreProps}
			>
				{showLess ? 'less' : '\u2026'}
			</Bubble>
		);
	};

	const ValueCrumb = ({
		css: customCSS,
		fieldName,
		nextSQON,
		value,
		...valueProps
	}: {
		fieldName: string;
		nextSQON: GroupSQONInterface;
		value: any;
	} & ThemeCommon.CustomCSS) => {
		const displayValue = translateSQONValue(
			internalTranslateSQONValue(
				(findExtendedMappingForField(fieldName)?.type === 'date' && format(value, dateFormat)) ||
					(findExtendedMappingForField(fieldName)?.displayValues || {})[value] ||
					value,
			),
		);

		const truncatedValue = truncate(displayValue, {
			length: Number(valueCharacterLimit || themeCharacterLimit),
		});
		const bubbleTitle = truncatedValue.endsWith('...') ? displayValue : undefined;

		return (
			<Value
				onClick={() => setSQON?.(nextSQON)}
				css={[themeSQONValueCustomCSS, customCSS]}
				title={bubbleTitle}
				theme={{
					textDecoration: 'underline',
					...themeSQONValueProps,
				}}
				{...valueProps}
			>
				{truncatedValue}
			</Value>
		);
	};

	return {
		Clear,
		FieldNameCrumb,
		isExpanded,
		LessOrMore,
		lessOrMoreClickHandler,
		ValueCrumb,
	};
};

export const SQONGroup = styled(
	({ className, ...props }: { className?: string }) => (
		<Row as="section" className={cx('sqon-group', className)} wrap {...props} />
	),
	{
		shouldForwardProp: isPropValid,
	},
)<SQONViewerThemeProps['SQONGroup']>`
	align-items: center;
`;

export const SQONValueGroup = styled(
	({ className, ...props }: { className?: string }) => (
		<span className={cx('sqon-value-group', className)} {...props} />
	),
	{
		shouldForwardProp: isPropValid,
	},
)<SQONViewerThemeProps['SQONValueGroup']>`
	align-items: center;
	background: ${({ background }) => background};
	border-color: ${({ borderColor }) => borderColor};
	border-radius: ${({ borderRadius }) => borderRadius};
	color: ${({ fontColor }) => fontColor};
	display: flex;
	font-size: ${({ fontSize }) => fontSize};
	font-weight: ${({ fontWeight }) => fontWeight};
	letter-spacing: ${({ letterSpacing }) => letterSpacing};
	line-height: ${({ lineHeight }) => lineHeight};
	margin: ${({ margin }) => margin};
	padding: ${({ padding }) => padding};
	text-transform: ${({ textTransform }) => textTransform};
`;

export const SQONWrapper = styled.article<SQONViewerThemeProps['SQONWrapper']>`
	align-items: center;
	color: ${({ fontColor }) => fontColor};
	display: flex;
	flex: 1;
	flex-wrap: wrap;
	font-size: ${({ fontSize }) => fontSize};
	font-weight: ${({ fontWeight }) => fontWeight};
	margin: 0;
	padding: 12px 0 12px 12px;
`;
