import React from 'react';
import ReactTreeView from './ReactTreeView';
import { css } from 'emotion';
import './style.css';

const NestedTreeView = ({
  dataSource,
  depth = 0,
  indentationPx = 20,
  labelPadding = 15,
  onLeafSelect = () => {},
  selectedPath = '',
}) =>
  dataSource.map(({ title, id, children, path }, i) => {
    const selectedPathArray =
      selectedPath?.split('.').filter(str => str.length) || [];
    const selectedClass = selectedPath === (id || title) ? 'selected' : '';
    const depthClass = `depth_${depth}`;
    return children ? (
      <ReactTreeView
        key={path}
        nodeLabel={
          <div
            className={`label ${css`
              display: inline;
              cursor: pointer;
              padding-left: ${labelPadding}px;
            `}`}
            onClick={e => {
              onLeafSelect(id || title);
            }}
          >
            {title}
          </div>
        }
        defaultCollapsed={true}
        labelPadding={labelPadding}
        itemClassName={`NestedTreeViewItem ${depthClass} ${selectedClass} ${css`
          padding-left: ${indentationPx * depth}px;
        `}`}
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
        className={`NestedTreeViewItem tree-view_children leaf
          ${depthClass}
          ${selectedClass}
        `}
      >
        <span
          className={css`
            padding-left: ${indentationPx * depth + labelPadding}px;
          `}
        >
          {title}
        </span>
      </div>
    );
  });

export default NestedTreeView;
