import React from 'react';
import SearchIcon from 'react-icons/lib/fa/search';

import State from '../State';
import TextInput from '../Input';
import { filterOutNonValue } from './utils.js';

export default class extends React.Component {
  state = { currentValue: '', isDropdownShown: false, highlightedField: null };
  dropdownRefs = {};

  onWindowClick = e =>
    this.setState({
      isDropdownShown: false,
      highlightedField: null,
    });

  handleKeyPress = e => {
    const filteredList = this.getFilteredList();
    const { highlightedField } = this.state;
    const { extendedMapping, onFieldSelect = () => {} } = this.props;
    const highlightedAgg = extendedMapping.find(
      ({ field }) => field === highlightedField,
    );

    // enter
    if (e.keyCode === 13) {
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

    // up
    if (e.keyCode === 38) {
      const newHighlightedField =
        filteredList?.[
          Math.max(
            (filteredList?.map(agg => agg.field).indexOf(highlightedField) ||
              0) - 1,
            0,
          )
        ]?.field || null;
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

    // down
    if (e.keyCode === 40) {
      const newHighlightedField =
        filteredList?.[
          Math.min(
            (filteredList?.map(agg => agg.field).indexOf(highlightedField) ||
              0) + 1,
            filteredList.length - 1,
          )
        ]?.field || null;
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

  getFilteredList = () => {
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

  getHighlightedHtmlTemplate = displayName => {
    const { currentValue } = this.state;
    const regex = new RegExp(currentValue, 'i');
    const matchResult = displayName.match(regex);
    const foundIndex = matchResult.index;
    const seg1 = displayName.substring(0, foundIndex);
    const foundQuery = matchResult[0];
    const seg2 = displayName.substring(
      foundIndex + foundQuery.length,
      displayName.length,
    );
    return (
      <span>
        {seg1}
        <span className="matched">{foundQuery}</span>
        {seg2}
      </span>
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
      withValueOnly,
      elasticMapping,
      extendedMapping,
      aggregations,
      onFieldSelect = () => {},
    } = this.props;
    const { currentValue, isDropdownShown, highlightedField } = this.state;
    const filteredList = this.getFilteredList();
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
                const newFilteredList = this.getFilteredList();
                this.setState({
                  highlightedField: newFilteredList?.[0]?.field,
                });
              },
            )
          }
          onKeyDown={e => this.handleKeyPress(e)}
        />
        {filteredList?.length && isDropdownShown ? (
          <div className={`resultList shown`}>
            {filteredList?.map(({ displayName, field, ...rest }) => (
              <div
                key={field}
                ref={el => (this.dropdownRefs[field] = el)}
                onMouseEnter={e => this.setState({ highlightedField: field })}
                className={`resultItem ${
                  highlightedField === field ? 'highlighted' : ''
                }`}
                onClick={() => {
                  this.setState({ currentValue: displayName });
                  onFieldSelect(field);
                }}
              >
                <span className="title">
                  {this.getHighlightedHtmlTemplate(displayName)}
                </span>
                <span className="field">{`(${field})`}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }
}
