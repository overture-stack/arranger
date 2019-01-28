import React from 'react';
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

export default ({
  projectId,
  graphqlField,
  api = defaultApi,
  useCache = true,
  children,
}) => {
  const initialState = { loading: true, extendedMapping: undefined };
  const didMount = async s => {
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
  };
  return (
    <Component initialState={initialState} didMount={didMount}>
      {s => children({ ...s.state })}
    </Component>
  );
};
