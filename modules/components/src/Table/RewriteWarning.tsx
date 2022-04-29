import { css } from '@emotion/react';

import { useThemeContext } from '@/ThemeContext';

// TODO: Delete this component once the Table is done.

const RewriteWarning = ({ hide = false }) => {
  const { colors } = useThemeContext({ callerName: 'Table - RewriteWarning' });

  return (
    <div
      css={css`
        background: ${colors?.grey?.[200]};
        display: ${hide && 'none'};
        font-style: italic;
        padding: 0.7rem 0.5rem;

        .code {
          background: ${colors?.grey?.[700]};
          color: ${colors?.grey?.[100]};
          font-size: 0.9em;
          font-style: normal;
          padding: 0 0.1rem;

          .tag {
            color: ${colors?.orange?.[300]};
            margin-right: 0.5rem;
          }
        }
      `}
    >
      The `Table` component is being redesigned, and may nor work correctly for your needs just yet.
      Most of the same functionalities will be available, with some additional ones we got from your
      feedback.
      <br />
      <br />
      To continue using the original table, please update your implementation to{' '}
      <span className="code">
        &lt;<span className="tag">OldTable</span>/&gt;
      </span>
      , which will be available until the new version is complete.
      <br />
      <br />
      (If you still wish to use this unfinished table version, you may remove this warning message
      by passing a`hideWarning` (boolean) props to the Table. e.g.{' '}
      <span className="code">
        &lt;<span className="tag">Table</span>hideWarning /&gt;
      </span>
      )
    </div>
  );
};

export default RewriteWarning;
