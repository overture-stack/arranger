import React from 'react';
import ReactTreeView from './ReactTreeView';
import { css } from 'emotion';
import './style.css';

const NestedTreeView = ({
  dataSource,
  depth = 0,
  indentationPx = 10,
  onLeafSelect = () => {},
  selectedPath = '',
}) =>
  dataSource.map(({ title, id, children, path }, i) => {
    const selectedPathArray =
      selectedPath?.split('.').filter(str => str.length) || [];
    const indentationStyle = css`
      padding-left: ${indentationPx * depth}px;
    `;
    return children ? (
      <ReactTreeView
        key={path}
        nodeLabel={
          <div
            className={'label'}
            style={{
              display: 'inline',
              cursor: 'pointer',
            }}
            onClick={e => {
              onLeafSelect(id || title);
            }}
          >
            {title}
          </div>
        }
        defaultCollapsed={true}
        itemClassName={`${selectedPath === (id || title) ? 'selected' : ''} ${
          depth === 0 ? 'header' : ''
        } ${indentationStyle}`}
      >
        <NestedTreeView
          onLeafSelect={selectedPath => {
            onLeafSelect(`${id || title}.${selectedPath}`);
          }}
          selectedPath={selectedPathArray.slice(1).join('.')}
          dataSource={children}
          depth={depth + 1}
        />
      </ReactTreeView>
    ) : (
      <div
        onClick={() => {
          onLeafSelect(id || title);
        }}
        key={path}
        className={`tree-view_children leaf
          ${depth === 0 ? 'header' : ''}
          ${selectedPath === (id || title) ? 'selected' : ''}
          ${indentationStyle}
        `}
      >
        {title}
      </div>
    );
  });

export default NestedTreeView;
