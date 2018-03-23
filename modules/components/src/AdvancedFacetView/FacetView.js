import React from 'react';
import FacetViewNode from './FacetViewNode';
import { debounce, toPairs } from 'lodash';
import { css } from 'emotion';
import { TermAgg, RangeAgg, BooleanAgg } from '../Aggs';
import { inCurrentSQON } from '../SQONView/utils';
import { currentFieldValue } from '../SQONView/utils';

const composedTermAgg = ({ sqon, onValueChange, ...rest }) => (
  <TermAgg
    {...rest}
    handleValueClick={({ generateNextSQON }) => {
      onValueChange({ sqon: generateNextSQON(sqon) });
    }}
    isActive={d =>
      inCurrentSQON({
        value: d.value,
        dotField: d.field,
        currentSQON: sqon,
      })
    }
  />
);
const composedRangeAgg = ({ sqon, onValueChange, field, stats, ...rest }) => (
  <RangeAgg
    value={{
      min:
        currentFieldValue({ sqon, dotField: field, op: '>=' }) ||
        stats?.min ||
        0,
      max:
        currentFieldValue({ sqon, dotField: field, op: '<=' }) ||
        stats?.max ||
        0,
    }}
    handleChange={({ generateNextSQON }) =>
      onValueChange({ sqon: generateNextSQON(sqon) })
    }
    {...{ ...rest, stats, field }}
  />
);
const composedBooleanAgg = ({ sqon, onValueChange, ...rest }) => (
  <BooleanAgg
    isActive={d =>
      inCurrentSQON({
        value: d.value,
        dotField: d.field,
        currentSQON: sqon,
      })
    }
    handleValueClick={({ generateNextSQON }) =>
      onValueChange({ sqon: generateNextSQON(sqon) })
    }
    {...rest}
  />
);

const aggComponents = {
  keyword: composedTermAgg,
  long: composedRangeAgg,
  float: composedRangeAgg,
  boolean: composedBooleanAgg,
};

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
          return (
            <div
              key={path}
              className={css`
                padding: 10px;
              `}
            >
              {aggComponents[type]?.({
                ...agg,
                field: path,
                displayName: title,
                onValueChange,
                sqon,
              })}
            </div>
          );
        })}
      </div>
    );
  }
}
