import React from 'react';
import { storiesOf } from '@storybook/react';
import { injectGlobal } from 'emotion';

import {
  Arranger,
  GetProjects,
  Aggregations,
  CurrentSQON,
  Table,
} from '../src/Arranger';
import State from '../src/State';
import { StyleProvider, AVAILABLE_THEMES } from '../src/ThemeSwitcher';
import {
  PORTAL_NAME,
  ACTIVE_INDEX,
  ACTIVE_INDEX_NAME,
  PROJECT_ID,
  deleteValue,
  setValue,
} from '../src/utils/config';

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
        box-shadow: 0 4px 5px 0 rgba(0, 0, 0, 0.14),
          0 1px 10px 0 rgba(0, 0, 0, 0.12), 0 2px 4px -1px rgba(0, 0, 0, 0.3);
      `}
    >
      {process.env.STORYBOOK_PORTAL_NAME ||
        process.env.STORYBOOK_PORTAL_NAME ||
        'Data Portal'}{' '}
      Search Page
      <div
        css={`
          margin-left: auto;
          cursor: pointer;
        `}
        onClick={() => {
          deleteValue('PROJECT_ID');
          deleteValue('ACTIVE_INDEX');
          deleteValue('ACTIVE_INDEX_NAME');
          update({ index: '', graphqlField: '', projectId: '' });
        }}
      >
        Logout
      </div>
    </div>
  );
};

const ChooseProject = ({ index, projectId, update, projects }) => {
  return (
    <div
      css={`
        display: flex;
        flex-direction: column;
        align-items: center;
        height: 100%;
        justify-content: center;
      `}
    >
      <h2
        css={`
          margin-top: 0;
        `}
      >
        {PORTAL_NAME}
      </h2>
      <select
        value={projectId}
        onChange={e => {
          setValue('PROJECT_ID', e.target.value);
          update({
            projectId: e.target.value,
          });
        }}
      >
        <option id="version">Select a version</option>
        {projects.map(x => (
          <option key={x.id} value={x.id}>
            {x.id}
          </option>
        ))}
      </select>
      <select
        value={index}
        onChange={e => {
          setValue('ACTIVE_INDEX', e.target.value);

          let graphqlField = projects
            .find(x => x.id === projectId)
            ?.types?.types.find(x => x.index === e.target.value).name;

          setValue('ACTIVE_INDEX_NAME', graphqlField);
          update({
            index: e.target.value,
            graphqlField,
          });
        }}
      >
        <option id="version">Select an index</option>
        {projects
          .find(x => x.id === projectId)
          ?.types?.types?.map(x => (
            <option key={x.index} value={x.index}>
              {x.index}
            </option>
          ))}
      </select>
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
        projectId: PROJECT_ID,
      }}
      render={({ index, graphqlField, projectId, update }) => {
        return index && projectId ? (
          <Arranger
            disableSocket
            index={index}
            graphqlField={graphqlField}
            projectId={projectId}
            render={props => {
              return (
                <>
                  <DemoHeader update={update} />
                  <Portal {...{ ...props, graphqlField, projectId }} />
                </>
              );
            }}
          />
        ) : (
          <GetProjects
            render={props => (
              <ChooseProject
                {...props}
                index={index}
                projectId={projectId}
                update={update}
              />
            )}
          />
        );
      }}
    />
  </>
));
