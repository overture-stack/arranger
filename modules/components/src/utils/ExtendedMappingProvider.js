import React from 'react';
import PropTypes from 'prop-types';
import Component from 'react-component-component';
import { default as defaultApi, fetchExtendedMapping } from './api';

const memoHash = {};
const memoizedExtendedMapping = ({ graphqlField, api }) => {
  if (!memoHash[graphqlField]) {
    memoHash[graphqlField] = fetchExtendedMapping({ graphqlField, api });
  }
  return memoHash[graphqlField];
};

const memoizedExtendedMappingField = ({ contentField, graphqlField, api }) => {
  const key = `${graphqlField}/${contentField}`;
  if (!memoHash[key]) {
    memoHash[key] = memoizedExtendedMapping({
      graphqlField,
      api,
    }).then(({ extendedMapping }) => extendedMapping.filter(({ field }) => field === contentField));
  }
  return memoHash[key];
};

const ExtendedMappingProvider = ({
  graphqlField,
  api = defaultApi,
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
            api,
          }).then(({ extendedMapping }) =>
            extendedMapping.filter(({ field }) => {
              return field === contentField;
            }),
          )
        : await memoizedExtendedMappingField({
            graphqlField,
            api,
            contentField,
          });
      s.setState({ loading: false, extendedMapping: extendedMapping });
    } else {
      const { extendedMapping } = !useCache
        ? await fetchExtendedMapping({
            graphqlField,
            api,
          })
        : await memoizedExtendedMapping({
            graphqlField,
            api,
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
  api: PropTypes.func,
  useCache: PropTypes.bool,
  field: PropTypes.string,
  graphqlField: PropTypes.string.isRequired,
  children: PropTypes.func.isRequired,
};

export default ExtendedMappingProvider;
