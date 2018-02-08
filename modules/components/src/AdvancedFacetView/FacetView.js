import React from 'react';
import FacetViewNode from './FacetViewNode';
import $ from 'jquery';
import { debounce } from 'lodash';

const serializeToDomId = path => path.split('.').join('__');
const serializeDomIdToPath = path => path.split('.').join('__');

export default class FacetView extends React.Component {
  state = {
    isAnimating: false,
  };
  componentWillReceiveProps({
    selectedMapping,
    path: selectedPath,
    aggregations,
    displayTreeData,
  }) {
    if (selectedPath) {
      this.scrollToPath(selectedPath);
    }
  }

  scrollToPath = path => {
    const targetElementId = serializeToDomId(path);
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
            complete: () => this.stopScrollAnimation(),
          },
        );
    }
  };

  stopScrollAnimation = () => {
    $(this.root).stop();
    this.setState({ isAnimating: false });
  };

  onScroll = e => {
    const { aggregations, onUserScroll = () => {} } = this.props;
    const { isAnimating } = this.state;
    if (!isAnimating) {
      onUserScroll(e);
    }
  };

  render() {
    const {
      selectedMapping,
      path: selectedPath,
      aggregations,
      displayTreeData,
      onValueChange,
      sqon = {},
    } = this.props;
    return (
      <div
        className="facetView"
        ref={el => (this.root = el)}
        onScroll={this.onScroll}
      >
        {displayTreeData.map(node => {
          return (
            <FacetViewNode
              depth={0}
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
