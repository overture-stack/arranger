import React from 'react';
import ReactTreeView from './ReactTreeView';
import './style.css';

const NestedTreeView = ({ dataSource }) =>
  dataSource.map(
    ({ title, id, children, isHeader }, i) =>
      children ? (
        <ReactTreeView
          key={id || i}
          nodeLabel={title}
          defaultCollapsed={true}
          itemClassName={isHeader && 'header'}
        >
          <NestedTreeView dataSource={children} />
        </ReactTreeView>
      ) : (
        <div key={id || i} className="tree-view_children leaf">
          {title}
        </div>
      ),
  );

export default NestedTreeView;
