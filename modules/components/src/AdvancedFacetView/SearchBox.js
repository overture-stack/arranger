import React from 'react';
import State from '../State';
import TextInput from '../Input';
import SearchIcon from 'react-icons/lib/fa/search';

import { filterOutNonValue } from './utils.js';

export default class extends React.Component {
  state = { currentValue: '', isDropdownShown: false };
  onWindowClick = e =>
    this.setState({
      isDropdownShown: false,
    });
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
    const { currentValue, isDropdownShown } = this.state;
    const filteredList = (withValueOnly
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
          onChange={e => this.setState({ currentValue: e.target.value })}
        />
        {filteredList?.length && isDropdownShown ? (
          <div className={`resultList shown`}>
            {filteredList?.map(({ displayName, field, ...rest }) => (
              <div
                key={field}
                className="resultItem"
                onClick={() => {
                  onFieldSelect(field);
                }}
              >
                <span className="title">{displayName}</span>
                <span className="field">{field}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }
}
