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
      console.log('animating!');
      $(this.root)
        .stop()
        .animate(
          {
            scrollTop: $(this.root).scrollTop() + element1.offset().top,
          },
          {
            duration: 500,
            complete: () => console.log('COMPLETE!'),
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
