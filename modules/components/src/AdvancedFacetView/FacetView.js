import React from 'react';
import { isEqual } from 'lodash';
import aggComponentsMap from '../Aggs/aggComponentsMap';
import TextHighlight from '../TextHighlight';

const serializeToDomId = path => path.split('.').join('__');

const flattenDisplayTreeData = displayTreeData => {
  return displayTreeData.reduce(
    (acc, node) => [
      ...acc,
      ...(node.children ? flattenDisplayTreeData(node.children) : [node]),
    ],
    [],
  );
};

export default class FacetView extends React.Component {
  state = {
    focusedPath: null,
  };
  scrollToPath = ({ path, behavior = 'smooth', block = 'start' }) => {
    const targetElementId = serializeToDomId(path);
    const targetElement = this.root.querySelector(`#${targetElementId}`);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior, block });
    }
  };
  componentDidUpdate({ sqon: lastSqon }) {
    const { focusedPath } = this.state;
    const { sqon } = this.props;
    if (!isEqual(lastSqon, sqon) && focusedPath) {
      this.scrollToPath({
        path: focusedPath,
        block: 'start',
        behavior: 'smooth',
      });
      this.setState({
        focusedPath: null,
      });
    }
  }
  shouldComponentUpdate(nextProps, nextState) {
    // performance optimization
    return !isEqual(nextProps, this.props);
  }
  render() {
    const {
      aggregations,
      displayTreeData,
      onValueChange,
      sqon = null,
      extendedMapping,
      searchString,
      onTermSelected,
    } = this.props;
    return (
      <div className="facetView" ref={el => (this.root = el)}>
        {flattenDisplayTreeData(displayTreeData).map(({ path }) => {
          const metaData = extendedMapping.find(({ field }) => field === path);
          const { type } = metaData || {};
          const paths = path
            .split('.')
            .reduce(
              (acc, node, i, paths) => [
                ...acc,
                [...paths.slice(0, i), node].join('.'),
              ],
              [],
            );
          const pathDisplayNames = paths.map(
            path =>
              extendedMapping.find(({ field }) => field === path)?.displayName,
          );
          const agg = aggregations[path];
          return aggComponentsMap[type]?.({
            ...metaData,
            ...agg,
            ...(type === 'keyword'
              ? (() => {
                  const columns = 4;
                  const maxTerms = columns * 2;
                  return {
                    maxTerms,
                    constructBucketItemClassName: ({
                      bucket,
                      showingBuckets,
                      i,
                      showingMore,
                    }) =>
                      `row_${Math.floor(i / columns)} col_${i % columns} ${
                        Math.floor(i / columns) ===
                        Math.floor((showingBuckets.length - 1) / columns)
                          ? 'last_row'
                          : ''
                      } ${showingBuckets.length <= columns ? 'only_row' : ''}`,
                  };
                })()
              : {}),
            key: path,
            field: path,
            getRangeAggProps: () => {
              return {
                step: metaData.rangeStep,
              };
            },
            onValueChange: ({ sqon, value }) => {
              this.setState(
                {
                  focusedPath: path,
                },
                () => {
                  onValueChange({ sqon, value });
                  onTermSelected?.(value);
                },
              );
            },
            highlightText: searchString,
            sqon,
            facetView: true,
            WrapperComponent: ({ displayName, collapsible, children }) => (
              <div id={serializeToDomId(path)} className={`facetContainer`}>
                <div className={`header`}>
                  <div className={`title`}>
                    <TextHighlight
                      content={displayName}
                      highlightText={searchString}
                    />
                  </div>
                  <div className={`breadscrumbs`}>
                    {pathDisplayNames
                      .slice(0, -1)
                      .map((pathName, index, arr) => (
                        <span key={index} className={`breadscrumb-item`}>
                          {pathName}
                        </span>
                      ))}
                  </div>
                </div>
                <div className={`content`}>{children}</div>
              </div>
            ),
          });
        })}
      </div>
    );
  }
}
