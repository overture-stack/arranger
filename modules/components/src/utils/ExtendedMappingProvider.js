import React from 'react';
import PropTypes from 'prop-types';
import Component from 'react-component-component';
import defaultApiFetcher, { fetchExtendedMapping } from './api';

const memoHash = {};
const memoizedExtendedMapping = ({ graphqlField, apiFetcher }) => {
  if (!memoHash[graphqlField]) {
    memoHash[graphqlField] = fetchExtendedMapping({ graphqlField, apiFetcher });
  }
  return memoHash[graphqlField];
};

const memoizedExtendedMappingField = ({ contentField, graphqlField, apiFetcher }) => {
  const key = `${graphqlField}/${contentField}`;
  if (!memoHash[key]) {
    memoHash[key] = memoizedExtendedMapping({
      graphqlField,
      apiFetcher,
    }).then(({ extendedMapping }) => extendedMapping.filter(({ field }) => field === contentField));
  }
  return memoHash[key];
};

const ExtendedMappingProvider = ({
  graphqlField,
  apiFetcher = defaultApiFetcher,
  useCache = true,
  field: contentField,
  children,
}) => {
  const initialState = { loading: true, extendedMapping: undefined };
  const didMount = async (s) => {
    if (contentField) {
      const extendedMapping = !useCache
        ? await fetchExtendedMapping({
            graphqlField,
            apiFetcher,
          }).then(({ extendedMapping }) =>
            extendedMapping.filter(({ field }) => {
              return field === contentField;
            }),
          )
        : await memoizedExtendedMappingField({
            graphqlField,
            apiFetcher,
            contentField,
          });
      s.setState({ loading: false, extendedMapping: extendedMapping });
    } else {
      const { extendedMapping } = !useCache
        ? await fetchExtendedMapping({
            graphqlField,
            apiFetcher,
          })
        : await memoizedExtendedMapping({
            graphqlField,
            apiFetcher,
          });
      s.setState({ loading: false, extendedMapping: extendedMapping });
    }
  };
  return (
    <Component initialState={initialState} didMount={didMount}>
      {(s) => children({ ...s.state })}
    </Component>
  );
};

ExtendedMappingProvider.prototype = {
  apiFetcher: PropTypes.func,
  useCache: PropTypes.bool,
  field: PropTypes.string,
  graphqlField: PropTypes.string.isRequired,
  children: PropTypes.func.isRequired,
};

export default ExtendedMappingProvider;
