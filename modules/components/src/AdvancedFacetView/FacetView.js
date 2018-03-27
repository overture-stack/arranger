import React from 'react';
import { debounce, toPairs, isEqual } from 'lodash';
import { css } from 'emotion';
import AggsWrapper from '../Aggs/AggsWrapper';
import aggComponents from './aggComponents';
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
  render() {
    const {
      aggregations,
      displayTreeData,
      onValueChange,
      sqon = null,
      constructEntryId,
      searchboxSelectionObservable,
      valueCharacterLimit,
      extendedMapping,
      searchString,
    } = this.props;
    return (
      <div className="facetView" ref={el => (this.root = el)}>
        {flattenDisplayTreeData(displayTreeData).map(({ title, path }) => {
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
          return aggComponents[type]?.({
            ...agg,
            key: path,
            field: path,
            onValueChange: ({ sqon }) => {
              this.setState(
                {
                  focusedPath: path,
                },
                () => {
                  onValueChange({ sqon });
                },
              );
            },
            searchString,
            sqon,
            WrapperComponent: ({ collapsible, children }) => (
              <div id={serializeToDomId(path)} className={`facetContainer`}>
                <div className={`header`}>
                  <div className={`title`}>
                    <TextHighlight
                      content={title}
                      highlightText={searchString}
                    />
                  </div>
                  <div className={`breadscrumb`}>
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
