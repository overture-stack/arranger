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
  shouldCollapse = () => undefined,
}) =>
  dataSource.map(({ title, id, children, path }, i) => {
    const selectedClass = selectedPath === path ? 'selected' : '';
    const depthClass = `depth_${depth}`;
    return children ? (
      <ReactTreeView
        key={path}
        nodeLabel={({ open }) => (
          <div
            className={`label ${css`
              display: inline-block;
              cursor: pointer;
              padding-left: ${labelPadding}px;
            `}`}
            onClick={e => {
              onLeafSelect(id || title);
              open();
            }}
          >
            <TextHighlight content={title} highlightText={searchString} />
          </div>
        )}
        defaultCollapsed={defaultCollapsed({
          depth,
          title,
          id,
          children,
          path,
        })}
        collapsed={shouldCollapse({ depth, title, id, children, path })}
        itemClassName={`NestedTreeViewNode nested ${depthClass} ${selectedClass} ${css`
          padding-left: ${indentationPx * depth}px;
        `}`}
      >
        <NestedTreeView
          onLeafSelect={onLeafSelect}
          selectedPath={selectedPath}
          dataSource={children}
          depth={depth + 1}
          searchString={searchString}
          defaultCollapsed={defaultCollapsed}
          shouldCollapse={shouldCollapse}
        />
      </ReactTreeView>
    ) : (
      <div
        onClick={() => onLeafSelect(path)}
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
