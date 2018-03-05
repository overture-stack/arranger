import React from 'react';
import FacetViewNode from './FacetViewNode';
import { debounce } from 'lodash';

const serializeToDomId = path => path.split('.').join('__');

export default class FacetView extends React.Component {
  scrollToPath = path => {
    const targetElementId = serializeToDomId(path);
    const targetElement = this.root.querySelector(`#${targetElementId}`);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  componentDidUpdate() {
    console.log(this.refs);
  }
  render() {
    const {
      aggregations,
      displayTreeData,
      onValueChange,
      sqon = {},
      constructEntryId,
    } = this.props;
    return (
      <div className="facetView" ref={el => (this.root = el)}>
        {displayTreeData.map(node => {
          return (
            <FacetViewNode
              ref={el => {
                this.refs = {
                  ...this.refs,
                  [node.path]: el,
                };
              }}
              constructEntryId={constructEntryId}
              depth={0}
              sqon={sqon}
              key={node.path}
              path={node.path}
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
