import React from 'react';
import SearchIcon from 'react-icons/lib/fa/search';

import State from '../State';
import TextInput from '../Input';
import { filterOutNonValue } from './utils.js';
import TextHighlight from '../TextHighlight';

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
    const filteredList = this.getFilteredList();
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
    const filteredList = this.getFilteredList();
    const { highlightedField } = this.state;
    if (keycode === keycodes.up) {
      return (
        filteredList?.[
          Math.max(
            filteredList?.map(agg => agg.field).indexOf(highlightedField) - 1,
            0,
          )
        ]?.field || null
      );
    } else if (keycode === keycodes.down) {
      return (
        filteredList?.[
          Math.min(
            filteredList?.map(agg => agg.field).indexOf(highlightedField) + 1,
            filteredList.length - 1,
          )
        ]?.field || null
      );
    } else {
      return null;
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
                  <TextHighlight
                    content={displayName}
                    highlightText={currentValue}
                  />
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
