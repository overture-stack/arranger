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
              <div
                id={serializeToDomId(path)}
                className={css`
                  margin-top: 10px;
                `}
              >
                <div
                  className={css`
                    display: flex;
                    flex-direction: row;
                    justify-content: space-between;
                    font-weight: bold;
                    background-color: #e7e8ed;
                    padding: 5px 20px;
                  `}
                >
                  <div
                    className={css`
                      color: #a42c90;
                    `}
                  >
                    <TextHighlight
                      content={title}
                      highlightText={searchString}
                    />
                  </div>
                  <div
                    className={css`
                      color: #2b388f;
                      text-align: right;
                    `}
                  >
                    {pathDisplayNames
                      .slice(0, pathDisplayNames.length - 1)
                      .join(' >> ')}
                  </div>
                </div>
                <div
                  className={css`
                    padding: 10px;
                  `}
                >
                  {children}
                </div>
              </div>
            ),
          });
        })}
      </div>
    );
  }
}
