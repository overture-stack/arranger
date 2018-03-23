import React from 'react';
import { css } from 'emotion';
import ReactTreeView from './ReactTreeView';
import TextHighlight from '../TextHighlight';
import './style.css';

const NestedTreeView = ({
  dataSource,
  depth = 0,
  indentationPx = 20,
  labelPadding = 15,
  onLeafSelect = () => {},
  selectedPath = '',
  searchString = null,
  defaultCollapsed = ({ depth }) => true,
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
              display: inline-block;
              cursor: pointer;
              padding-left: ${labelPadding}px;
            `}`}
            onClick={e => {
              onLeafSelect(id || title);
            }}
          >
            <TextHighlight content={title} highlightText={searchString} />
          </div>
        }
        defaultCollapsed={defaultCollapsed({ depth })}
        itemClassName={`NestedTreeViewNode nested ${depthClass} ${selectedClass} ${css`
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
          searchString={searchString}
        />
      </ReactTreeView>
    ) : (
      <div
        onClick={() => {
          onLeafSelect(id || title);
        }}
        key={path}
        className={`NestedTreeViewNode tree-view_children leaf
          ${depthClass}
          ${selectedClass}
        `}
      >
        <div
          className={css`
            padding-left: ${indentationPx * depth + labelPadding}px;
          `}
        >
          <TextHighlight content={title} highlightText={searchString} />
        </div>
      </div>
    );
  });

export default NestedTreeView;
