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
    disPlayTreeData,
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

  onScroll = debounce(e => {
    const { aggregations, onUserScroll = () => {} } = this.props;
    const { isAnimating } = this.state;
    this.stopScrollAnimation();
    if (!isAnimating) {
      const allFacetPaths = Object.keys(aggregations);
      const allNodeDomElements = allFacetPaths
        .map(serializeToDomId)
        .map(id => $(this.root).find(`#${id}`))
        .filter(el => el[0]);
      const rootTop = $(this.root).offset().top;
      const currentTopElement = allNodeDomElements.find(element => {
        const elementTop = element.offset().top - 1;
        const elementHeight = element.outerHeight();
        return elementTop + elementHeight > rootTop && elementTop < rootTop;
      });
      if (currentTopElement) {
        const currentTopElementId = currentTopElement.attr('id');
        const currentTopPath = serializeDomIdToPath(currentTopElementId);
        onUserScroll({ topPath: currentTopElementId });
      } else {
        console.log('FAIL!!!');
      }
    }
  }, 500);

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
      <div
        className="facetView"
        ref={el => (this.root = el)}
        onScroll={this.onScroll}
      >
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
