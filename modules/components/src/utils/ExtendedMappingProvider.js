import React from 'react';
import PropTypes from 'prop-types';
import Component from 'react-component-component';
import { default as defaultApi, fetchExtendedMapping } from './api';

const memoHash = {};
const memoizedExtendedMapping = ({ projectId, graphqlField, api }) => {
  const key = `${projectId}/${graphqlField}`;
  if (!memoHash[key]) {
    memoHash[key] = fetchExtendedMapping({ projectId, graphqlField, api });
  }
  return memoHash[key];
};

const memoizedExtendedMappingField = ({
  contentField,
  projectId,
  graphqlField,
  api,
}) => {
  const key = `${projectId}/${graphqlField}/${contentField}`;
  if (!memoHash[key]) {
    memoHash[key] = memoizedExtendedMapping({
      projectId,
      graphqlField,
      api,
    }).then(({ extendedMapping }) =>
      extendedMapping.filter(({ field }) => field === contentField),
    );
  }
  return memoHash[key];
};

const ExtendedMappingProvider = ({
  projectId,
  graphqlField,
  api = defaultApi,
  useCache = true,
  field: contentField,
  children,
}) => {
  const initialState = { loading: true, extendedMapping: undefined };
  const didMount = async s => {
    if (contentField) {
      const extendedMapping = !useCache
        ? await fetchExtendedMapping({
            projectId,
            graphqlField,
            api,
          }).then(({ extendedMapping }) =>
            extendedMapping.filter(({ field }) => {
              return field === contentField;
            }),
          )
        : await memoizedExtendedMappingField({
            projectId,
            graphqlField,
            api,
            contentField,
          });
      s.setState({ loading: false, extendedMapping: extendedMapping });
    } else {
      const { extendedMapping } = !useCache
        ? await fetchExtendedMapping({
            projectId,
            graphqlField,
            api,
          })
        : await memoizedExtendedMapping({
            projectId,
            graphqlField,
            api,
          });
      s.setState({ loading: false, extendedMapping: extendedMapping });
    }
  };
  return (
    <Component initialState={initialState} didMount={didMount}>
      {s => children({ ...s.state })}
    </Component>
  );
};

ExtendedMappingProvider.prototype = {
  api: PropTypes.func,
  useCache: PropTypes.bool,
  field: PropTypes.string,
  projectId: PropTypes.string.isRequired,
  graphqlField: PropTypes.string.isRequired,
  children: PropTypes.func.isRequired,
};

export default ExtendedMappingProvider;
