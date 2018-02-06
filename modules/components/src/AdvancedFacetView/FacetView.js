import React from 'react';
import FacetViewNode from './FacetViewNode';
import $ from 'jquery';

export default class FacetView extends React.Component {
  componentWillReceiveProps({
    selectedMapping,
    path: selectedPath,
    aggregations,
    disPlayTreeData,
  }) {
    if (selectedPath && selectedPath != this.props.path) {
      this.scrollToPath(selectedPath);
    }
  }

  scrollToPath = path => {
    const targetElementId = path.split('.').join('__');
    const targetElement = $(this.root).find(`#${targetElementId}`);
    if (targetElement) {
      $(this.root)
        .stop()
        .animate(
          {
            scrollTop: $(this.root).scrollTop() + targetElement.offset().top,
          },
          1000,
        );
    }
  };

  render() {
    const {
      selectedMapping,
      path: selectedPath,
      aggregations,
      disPlayTreeData,
    } = this.props;
    return (
      <div className="facetView" ref={el => (this.root = el)}>
        {disPlayTreeData.map(node => {
          return (
            <FacetViewNode
              key={node.path}
              aggregations={aggregations}
              {...node}
            />
          );
        })}
      </div>
    );
  }
}
