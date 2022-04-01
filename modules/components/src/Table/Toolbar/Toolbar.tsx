import { css } from '@emotion/react';
import cx from 'classnames';

const Toolbar = () => {
  return (
    <section
      className={cx('tableToolbar')}
      css={css`
        display: flex;
        flex: none;
      `}
    >
      this be toolbar
    </section>
  );
};

export default Toolbar;
