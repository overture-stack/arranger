import React from 'react';
import FacetViewNode from './FacetViewNode';
import $ from 'jquery';

export default class FacetView extends React.Component {
  state = {
    isAnimating: false,
  };
  componentWillReceiveProps({
    selectedMapping,
    path: selectedPath,
    aggregations,
    disPlayTreeData,
  }) {
    if (selectedPath) {
      this.scrollToPath(selectedPath);
    }
  }

  scrollToPath = path => {
    const targetElementId = path.split('.').join('__');
    const targetElement = $(this.root).find(`#${targetElementId}`);
    if (targetElement) {
      this.setState({ isAnimating: true });
      $(this.root)
        .stop()
        .animate(
          {
            scrollTop:
              $(this.root).scrollTop() +
              targetElement.offset().top -
              $(this.root).offset().top,
          },
          {
            duration: 500,
            complete: () => this.setState({ isAnimating: false }),
          },
        );
    }
  };

  render() {
    const {
      selectedMapping,
      path: selectedPath,
      aggregations,
      disPlayTreeData,
      onValueChange,
      sqon = {},
    } = this.props;
    return (
      <div className="facetView" ref={el => (this.root = el)}>
        {disPlayTreeData.map(node => {
          return (
            <FacetViewNode
              sqon={sqon}
              key={node.path}
              aggregations={aggregations}
              onValueChange={({ value, path, esType, aggType }) =>
                onValueChange({ value, path, esType, aggType })
              }
              {...node}
            />
          );
        })}
      </div>
    );
  }
}
