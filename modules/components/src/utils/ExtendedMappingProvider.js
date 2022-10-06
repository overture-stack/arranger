import React from 'react';
import PropTypes from 'prop-types';
import Component from 'react-component-component';
import defaultApiFetcher, { fetchExtendedMapping } from './api';

const memoHash = {};
const memoizedExtendedMapping = ({ documentType, apiFetcher }) => {
  if (!memoHash[documentType]) {
    memoHash[documentType] = fetchExtendedMapping({ documentType, apiFetcher });
  }
  return memoHash[documentType];
};

const memoizedExtendedMappingField = ({ contentFieldName, documentType, apiFetcher }) => {
  const key = `${documentType}/${contentFieldName}`;
  if (!memoHash[key]) {
    memoHash[key] = memoizedExtendedMapping({
      documentType,
      apiFetcher,
    }).then(({ extendedMapping }) =>
      extendedMapping.filter(({ fieldName }) => fieldName === contentFieldName),
    );
  }
  return memoHash[key];
};

const ExtendedMappingProvider = ({
  documentType,
  apiFetcher = defaultApiFetcher,
  useCache = true,
  fieldName: contentFieldName,
  children,
}) => {
  const initialState = { loading: true, extendedMapping: undefined };
  const didMount = async (s) => {
    if (contentFieldName) {
      const extendedMapping = !useCache
        ? await fetchExtendedMapping({
            documentType,
            apiFetcher,
          }).then(({ extendedMapping }) =>
            extendedMapping.filter(({ fieldName }) => {
              return fieldName === contentFieldName;
            }),
          )
        : await memoizedExtendedMappingField({
            documentType,
            apiFetcher,
            contentFieldName,
          });
      s.setState({ loading: false, extendedMapping });
    } else {
      const { extendedMapping } = !useCache
        ? await fetchExtendedMapping({
            documentType,
            apiFetcher,
          })
        : await memoizedExtendedMapping({
            documentType,
            apiFetcher,
          });
      s.setState({ loading: false, extendedMapping });
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
  fieldName: PropTypes.string,
  documentType: PropTypes.string.isRequired,
  children: PropTypes.func.isRequired,
};

export default ExtendedMappingProvider;
