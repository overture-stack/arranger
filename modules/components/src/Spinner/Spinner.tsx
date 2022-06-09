import { css } from '@emotion/react';
import Spinkit from 'react-spinkit';
import cx from 'classnames';

import { useThemeContext } from '@/ThemeContext';
import { emptyObj } from '@/utils/noops';

import { SpinnerProps } from './types';

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

const Loader = ({
  children,
  className = '',
  theme: {
    css: customCSS,
    color: customColor,
    inverted,
    size: customSize,
    Spinner = DefaultSpinner,
    vertical,
  } = emptyObj,
}: SpinnerProps) => {
  const {
    colors,
    components: {
      Spinner: { color: themeColor = colors?.grey?.[600], size: themeSize = 30 } = emptyObj,
    } = emptyObj,
  } = useThemeContext({ callerName: 'Spinner' });

  const spacingFromSpinner = `margin-${
    vertical ? (inverted ? 'bottom' : 'top') : inverted ? 'right' : 'left'
  }: 0.5rem;`;

  return (
    <figure
      className={cx('Spinner', className)}
      css={[
        css`
          align-items: center;
          bottom: 0px;
          display: flex;
          flex-direction: ${vertical ? 'column' : 'row'}${inverted ? '-reverse' : ''};
          justify-content: center;
          left: 0px;
          margin: 0;
          right: 0px;
          top: 0px;
        `,
        customCSS,
      ]}
    >
      <Spinner color={customColor || themeColor} size={customSize || themeSize} />

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

export default Loader;
