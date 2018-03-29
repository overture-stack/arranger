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
    const {
      getCombinedFilteredList,
      state: { highlightedField },
      props: { onFieldSelect = () => {} },
    } = this;
    const highlightedEntry = getCombinedFilteredList().find(
      ({ id }) => id === highlightedField,
    );

    if (e.keyCode === keycodes.enter) {
      this.setState({
        isDropdownShown: false,
        highlightedField: null,
        ...(highlightedEntry
          ? {
              currentValue:
                highlightedEntry.value || highlightedEntry.displayName,
            }
          : {}),
      });
      onFieldSelect({
        field: highlightedEntry.field,
        value: highlightedEntry.value,
      });
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
    const filteredList = this.getCombinedFilteredList();
    const { highlightedField } = this.state;
    if (keycode === keycodes.up) {
      return (
        filteredList?.[
          Math.max(
            filteredList?.map(entry => entry.id).indexOf(highlightedField) - 1,
            0,
          )
        ]?.id || null
      );
    } else if (keycode === keycodes.down) {
      return (
        filteredList?.[
          Math.min(
            filteredList?.map(entry => entry.id).indexOf(highlightedField) + 1,
            filteredList.length - 1,
          )
        ]?.id || null
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
                      value: bucket.key_as_string || bucket.key,
                    }))
                  : []),
              ],
              [],
            )
            .filter(({ value }) =>
              value.toLowerCase().includes(currentValue.toLowerCase()),
            );
  };

  getCombinedFilteredList = () => {
    const {
      getFilteredFacets,
      getFilteredFacetValues,
      getDisplayNameByField,
      props: {
        constructEntryId = ({ field, value }) =>
          value ? `${field}_${value}` : field,
      },
    } = this;
    const filteredFacetsList = getFilteredFacets();
    const filteredValueList = getFilteredFacetValues();
    const combinedSet = toPairs(
      groupBy(
        (filteredFacetsList || []).concat(filteredValueList || []),
        'field',
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
            id: constructEntryId(entry),
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
        onValueChange = () => {},
      },
      state: { currentValue, isDropdownShown, highlightedField },
      getCombinedFilteredList,
      handleKeyPress,
    } = this;

    const filteredList = getCombinedFilteredList();

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
                const newFilteredList = getCombinedFilteredList();
                this.setState(
                  {
                    highlightedField: newFilteredList?.[0]?.field,
                  },
                  () => onValueChange({ value: this.state.currentValue }),
                );
              },
            )
          }
          onKeyDown={handleKeyPress}
        />
      </div>
    );
  }
}
