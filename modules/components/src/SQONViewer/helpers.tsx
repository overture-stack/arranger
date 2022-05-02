import { useCallback, useState } from 'react';
import isPropValid from '@emotion/is-prop-valid';
import { css } from '@emotion/react';
import styled from '@emotion/styled';
import { truncate, xor } from 'lodash';
import { format } from 'date-fns';
import cx from 'classnames';

import { TransparentButton } from '@/Button';
import ButtonProps from '@/Button/types';
import { useDataContext } from '@/DataContext';
import { Row } from '@/Flex';
import { useThemeContext } from '@/ThemeContext';
import { ThemeCommon } from '@/ThemeContext/types';
import { emptyObj } from '@/utils/noops';
import internalTranslateSQONValue from '@/utils/translateSQONValue';

import {
  GroupSQONInterface,
  GroupValueSQONType,
  UseDataBubblesProps,
  ValueSQONInterface,
} from './types';

interface BubbleProps extends ButtonProps {
  onClick?: () => void;
}

export const Bubble = ({ children, className, ...props }: BubbleProps) => {
  const {
    components: {
      SQONViewer: { SQONBubble: themeSQONBubbleProps = emptyObj } = emptyObj,
    } = emptyObj,
  } = useThemeContext({ callerName: 'SQONViewer - Bubble' });

  return (
    <TransparentButton
      className={cx('sqon-bubble', className)}
      css={css``}
      margin="0 0.2em"
      {...themeSQONBubbleProps}
      {...props}
    >
      {children}
    </TransparentButton>
  );
};

export const Field = ({ children, className, ...props }: BubbleProps) => (
  <Bubble className={cx('sqon-field', className)} {...props}>
    {children}
  </Bubble>
);

export const Op = ({ children, className, ...props }: BubbleProps) => (
  <Bubble className={cx('sqon-op', className)} {...props}>
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
        SQONClear: themeSQONClearProps = emptyObj,
        SQONField: themeSQONFieldProps = emptyObj,
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

  const isExpanded = useCallback(
    (valueSQON: ValueSQONInterface) => expanded.includes(valueSQON),
    [expanded],
  );

  const { extendedMapping } = useDataContext({ callerName: 'SQONViewer - useDataBubbles' });
  const findExtendedMappingForField = useCallback(
    (wantedField) => extendedMapping.find((mapping) => mapping.field === wantedField),
    [extendedMapping],
  );

  const Clear = ({ nextSQON }: { nextSQON: GroupSQONInterface | null }) => (
    <Bubble
      background={colors?.grey?.[200]}
      borderRadius="0.3em"
      className="sqon-clear"
      css={css`
        margin-left: 0;
        margin-right: 0.5em;
      `}
      disabledBackground={colors?.grey?.[100]}
      hoverBackground={colors?.grey?.[300]}
      onClick={() => {
        onClear?.();
        setSQON?.(nextSQON);
      }}
      padding="0.2em 0.5em"
      {...themeSQONClearProps}
    >
      Clear
    </Bubble>
  );

  const FieldCrumb = ({ field, ...fieldProps }: { field: string }) => (
    <Field css={css``} fontWeight="bold" {...themeSQONFieldProps} {...{ field, ...fieldProps }}>
      {findExtendedMappingForField(field)?.displayName || field}
    </Field>
  );

  const lessOrMoreClickHandler = useCallback(
    (valueSQON) => () => setExpanded(xor(expanded, [valueSQON])),
    [expanded],
  );

  const LessOrMore = ({ valueSQON }: { valueSQON: ValueSQONInterface }) => {
    const showLess = isExpanded(valueSQON);

    return (
      <Bubble
        className={cx(showLess ? 'sqon-less' : 'sqon-more')}
        css={css``}
        onClick={lessOrMoreClickHandler(valueSQON)}
        {...themeSQONLessOrMoreProps}
      >
        {showLess ? 'less' : '\u2026'}
      </Bubble>
    );
  };

  const ValueCrumb = ({
    css: customCSS,
    field,
    nextSQON,
    value,
    ...valueProps
  }: {
    field: string;
    nextSQON: GroupSQONInterface;
    value: any;
  } & ThemeCommon.CustomCSS) => {
    const displayValue = translateSQONValue(
      internalTranslateSQONValue(
        (findExtendedMappingForField(field)?.type === 'date' && format(value, dateFormat)) ||
          (findExtendedMappingForField(field)?.displayValues || {})[value] ||
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
        textDecoration="underline"
        title={bubbleTitle}
        {...themeSQONValueProps}
        {...valueProps}
      >
        {truncatedValue}
      </Value>
    );
  };

  return {
    Clear,
    FieldCrumb,
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
)<ThemeCommon.NonButtonThemeProps>`
  align-items: center;
`;

export const SQONValueGroup = styled(
  ({ className, ...props }: { className?: string }) => (
    <span className={cx('sqon-value-group', className)} {...props} />
  ),
  {
    shouldForwardProp: isPropValid,
  },
)<ThemeCommon.NonButtonThemeProps>`
  background: ${({ background }) => background};
  border-color: ${({ borderColor }) => borderColor};
  border-radius: ${({ borderRadius }) => borderRadius};
  color: ${({ fontColor }) => fontColor};
  font-size: ${({ fontSize }) => fontSize};
  font-weight: ${({ fontWeight }) => fontWeight};
  letter-spacing: ${({ letterSpacing }) => letterSpacing};
  line-height: ${({ lineHeight }) => lineHeight};
  margin: ${({ margin }) => margin};
  padding: ${({ padding }) => padding};
  text-transform: ${({ textTransform }) => textTransform};
`;

export const SQONWrapper = styled.article<ThemeCommon.NonButtonThemeProps>`
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
