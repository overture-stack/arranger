import { ElementType } from 'react';
import { css } from '@emotion/react';
import Spinkit from 'react-spinkit';
import cx from 'classnames';

import { useThemeContext } from '@/ThemeContext';
import { ThemeCommon } from '@/ThemeContext/types';
import { emptyObj } from '@/utils/noops';

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

const Spinner = ({
  className = '',
  color: customColor,
  css: customCSS,
  size: customSize,
  Spinner = DefaultSpinner,
}: {
  color?: string;
  size?: string | number;
  Spinner?: ElementType;
} & ThemeCommon.CustomCSS) => {
  const {
    colors,
    components: {
      Spinner: { color: themeColor = colors?.grey?.[600], size: themeSize = 30 } = emptyObj,
    } = emptyObj,
  } = useThemeContext({ callerName: 'Spinner' });

  return (
    <div
      className={cx('Spinner', className)}
      css={[
        css`
          position: absolute;
          left: 0px;
          right: 0px;
          top: 0px;
          bottom: 0px;
          display: flex;
          justify-content: center;
          align-items: center;
        `,
        customCSS,
      ]}
    >
      <Spinner color={customColor || themeColor} size={customSize || themeSize} />
    </div>
  );
};

export default Spinner;
