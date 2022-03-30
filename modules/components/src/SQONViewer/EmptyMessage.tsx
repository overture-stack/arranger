import { css } from '@emotion/react';
import cx from 'classnames';

import { useThemeContext } from '@/ThemeContext';

const EmptyMessage = ({ className, message }: { className?: string; message: string }) => {
  const {
    components: {
      SQONViewer: {
        EmptyMessage: {
          className: themeClassName = undefined,
          fontColor: themeFontColor = undefined,
          fontSize: themeFontSize = undefined,
          fontWeight: themeFontWeight = 'normal',
        } = {},
      } = {},
    } = {},
  } = useThemeContext();

  return (
    <div
      className={cx('sqon-empty-message', themeClassName, className)}
      css={css`
        color: ${themeFontColor};
        font-size: ${themeFontSize};
        font-weight: ${themeFontWeight};
      `}
    >
      <span
        className="sqon-empty-message-arrow"
        css={css`
          margin-right: 0.2em;
        `}
      >
        {'\u2190'}
      </span>

      {message}
    </div>
  );
};

export default EmptyMessage;
