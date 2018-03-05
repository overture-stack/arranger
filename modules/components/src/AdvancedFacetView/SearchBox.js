import React from 'react';
import SearchIcon from 'react-icons/lib/fa/search';

import State from '../State';
import TextInput from '../Input';
import { filterOutNonValue } from './utils.js';
import TextHighlight from '../TextHighlight';
import { groupBy, toPairs } from 'lodash';

const keycodes = {
  enter: 13,
  up: 38,
  down: 40,
};

export default class extends React.Component {
  state = { currentValue: '', isDropdownShown: false, highlightedField: null };
  dropdownRefs = {};

  onWindowClick = e =>
    this.setState({
      isDropdownShown: false,
      highlightedField: null,
    });

  handleKeyPress = e => {
    const filteredFacetsList = this.getFilteredFacets();
    const { highlightedField } = this.state;
    const { extendedMapping, onFieldSelect = () => {} } = this.props;
    const highlightedAgg = extendedMapping.find(
      ({ field }) => field === highlightedField,
    );

    if (e.keyCode === keycodes.enter) {
      this.setState({
        isDropdownShown: false,
        highlightedField: null,
        ...(highlightedAgg
          ? {
              currentValue: highlightedAgg.displayName,
            }
          : {}),
      });
      onFieldSelect(highlightedField);
    }

    if (e.keyCode === keycodes.up || e.keyCode === keycodes.down) {
      const newHighlightedField = this.getNextHighlightedField(e.keyCode);
      e.preventDefault();
      this.setState(
        {
          highlightedField: newHighlightedField,
        },
        () =>
          this.dropdownRefs[newHighlightedField]?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          }),
      );
    }
  };

  getNextHighlightedField = keycode => {
    const filteredFacetsList = this.getFilteredFacets();
    const { highlightedField } = this.state;
    if (keycode === keycodes.up) {
      return (
        filteredFacetsList?.[
          Math.max(
            filteredFacetsList
              ?.map(agg => agg.field)
              .indexOf(highlightedField) - 1,
            0,
          )
        ]?.field || null
      );
    } else if (keycode === keycodes.down) {
      return (
        filteredFacetsList?.[
          Math.min(
            filteredFacetsList
              ?.map(agg => agg.field)
              .indexOf(highlightedField) + 1,
            filteredFacetsList.length - 1,
          )
        ]?.field || null
      );
    } else {
      return null;
    }
  };

  getFilteredFacetValues = () => {
    const { aggregations } = this.props;
    const { currentValue } = this.state;
    return !currentValue?.length
      ? []
      : !aggregations
        ? []
        : Object.entries(aggregations)
            .reduce(
              (acc, [key, agg]) => [
                ...acc,
                ...(agg.buckets
                  ? agg.buckets.map(bucket => ({
                      field: key.split('__').join('.'),
                      value: bucket.key,
                    }))
                  : []),
              ],
              [],
            )
            .filter(({ value }) => value.includes(currentValue));
  };

  getCombinedFilteredList = () => {
    const {
      getFilteredFacets,
      getFilteredFacetValues,
      getDisplayNameByField,
    } = this;
    const filteredFacetsList = getFilteredFacets();
    const filteredValueList = getFilteredFacetValues();
    const combinedSet = toPairs(
      groupBy(
        (filteredFacetsList || []).concat(filteredValueList || []),
        entry => entry.field,
      ),
    ).reduce(
      (acc, [field, group]) => [
        ...acc,
        ...group
          .map(
            entry =>
              entry.displayName
                ? entry
                : { ...entry, displayName: getDisplayNameByField(field) },
          )
          .map(entry => ({
            ...entry,
            id: entry.value ? `${field}_${entry.value}` : field,
          })),
      ],
      [],
    );
    return combinedSet;
  };

  getDisplayNameByField = field =>
    this.props.extendedMapping.find(entry => entry.field === field).displayName;

  getFilteredFacets = () => {
    const {
      withValueOnly,
      elasticMapping,
      extendedMapping,
      aggregations,
      onFieldSelect = () => {},
    } = this.props;
    const { currentValue, isDropdownShown, highlightedField } = this.state;
    return (withValueOnly
      ? filterOutNonValue({ extendedMapping, aggregations })
          .extendedMappingWithValue
      : extendedMapping
    )?.filter?.(
      ({ displayName }) =>
        displayName
          .toLowerCase()
          .indexOf(
            (currentValue?.length ? currentValue : null)?.toLowerCase(),
          ) > -1,
    );
  };

  componentDidMount() {
    window.addEventListener('click', this.onWindowClick);
  }

  componentWillUnmount() {
    window.removeEventListener('click', this.onWindowClick);
  }

  render() {
    const {
      props: {
        withValueOnly,
        elasticMapping,
        extendedMapping,
        aggregations,
        onFieldSelect = () => {},
      },
      state: { currentValue, isDropdownShown, highlightedField },
      getFilteredFacets,
      getCombinedFilteredList,
      handleKeyPress,
    } = this;

    const combinedFilteredList = getCombinedFilteredList();
    console.log('combinedFilteredList: ', getCombinedFilteredList());

    const filteredFacetsList = getFilteredFacets();

    return (
      <div className="filterWrapper">
        <TextInput
          icon={<SearchIcon />}
          className="filterInput"
          type="text"
          placeholder="Filter"
          value={currentValue}
          onClick={e => {
            this.setState({ isDropdownShown: true });
            e.stopPropagation();
          }}
          onChange={e =>
            this.setState(
              {
                isDropdownShown: true,
                currentValue: e.target.value,
              },
              () => {
                const newFilteredList = getFilteredFacets();
                this.setState({
                  highlightedField: newFilteredList?.[0]?.field,
                });
              },
            )
          }
          onKeyDown={handleKeyPress}
        />
        {filteredFacetsList?.length && isDropdownShown ? (
          <div className={`resultList shown`}>
            {filteredFacetsList?.map(
              ({ displayName: fieldDisplayName, value, field }) => {
                return (
                  <div
                    key={field}
                    ref={el => (this.dropdownRefs[field] = el)}
                    onMouseEnter={e =>
                      this.setState({ highlightedField: field })
                    }
                    className={`resultItem ${
                      highlightedField === field ? 'highlighted' : ''
                    }`}
                    onClick={() => {
                      this.setState({
                        currentValue: fieldDisplayName || value,
                      });
                      onFieldSelect(field);
                    }}
                  >
                    <span className="title">
                      <TextHighlight
                        content={fieldDisplayName || value}
                        highlightText={currentValue}
                      />
                    </span>
                    <span className="field">{`(${field})`}</span>
                  </div>
                );
              },
            )}
          </div>
        ) : null}
      </div>
    );
  }
}
