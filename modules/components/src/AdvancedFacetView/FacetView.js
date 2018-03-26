import React from 'react';
import { debounce, toPairs } from 'lodash';
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
  scrollToPath = path => {
    const targetElementId = serializeToDomId(path);
    const targetElement = this.root.querySelector(`#${targetElementId}`);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
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
            onValueChange,
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
                      .slice(0, pathDisplayNames.length - 1)
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
