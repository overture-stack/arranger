import React from 'react';
import { storiesOf } from '@storybook/react';
import { injectGlobal } from 'emotion';

import { Arranger, Aggregations, CurrentSQON, Table } from '../src/Arranger';
import State from '../src/State';
import { StyleProvider, AVAILABLE_THEMES } from '../src/ThemeSwitcher';
import { ACTIVE_INDEX, ACTIVE_INDEX_NAME, deleteValue } from '../src/utils/config';

injectGlobal`
  html,
  body,
  #root {
    height: 100vh;
    margin: 0;
  }
`;

const DemoHeader = ({ update }) => {
  return (
    <div
      css={`
        z-index: 1;
        flex: none;
        display: flex;
        line-height: 40px;
        padding: 0 20px;
        font-size: 20px;
        font-weight: bold;
        box-shadow: 0 4px 5px 0 rgba(0, 0, 0, 0.14), 0 1px 10px 0 rgba(0, 0, 0, 0.12),
          0 2px 4px -1px rgba(0, 0, 0, 0.3);
      `}
    >
      {process.env.STORYBOOK_PORTAL_NAME || process.env.STORYBOOK_PORTAL_NAME || 'Data Portal'}{' '}
      Search Page
      <div
        css={`
          margin-left: auto;
          cursor: pointer;
        `}
        onClick={() => {
          deleteValue('ACTIVE_INDEX');
          deleteValue('ACTIVE_INDEX_NAME');
          update({ index: '', graphqlField: '' });
        }}
      >
        Logout
      </div>
    </div>
  );
};

const Portal = ({ style, ...props }) => {
  return (
    <div style={{ display: 'flex', ...style }}>
      <Aggregations
        style={{ width: 300 }}
        componentProps={{
          getTermAggProps: () => ({
            maxTerms: 3,
          }),
        }}
        {...props}
      />
      <div
        css={`
          position: relative;
          flex-grow: 1;
          display: flex;
          flex-direction: column;
        `}
      >
        <CurrentSQON {...props} />
        <Table {...props} />
      </div>
    </div>
  );
};

storiesOf('Portal', module).add('Portal', () => (
  <>
    <StyleProvider selected="beagle" availableThemes={AVAILABLE_THEMES} />
    <State
      initial={{
        index: ACTIVE_INDEX,
        graphqlField: ACTIVE_INDEX_NAME,
      }}
      render={({ index, graphqlField, update }) =>
        index ? (
          <Arranger
            disableSocket
            index={index}
            graphqlField={graphqlField}
            render={(props) => {
              return (
                <>
                  <DemoHeader update={update} />
                  <Portal {...{ ...props, graphqlField }} />
                </>
              );
            }}
          />
        ) : (
          <div>No index available</div>
        )
      }
    />
  </>
));
