import React from 'react';
import PropTypes from 'prop-types';
import TermFilter from './TermFilter';
import RangeFilter from './RangeFilter';
import ExtendedMappingProvider from '../../utils/ExtendedMappingProvider';
import { default as defaultApi } from '../../utils/api';
import { PROJECT_ID } from '../../utils/config';
import { FilterContainer } from './common';

export { default as TermFilter } from './TermFilter';
export { default as RangeFilter } from './RangeFilter';

const FieldOpModifier = ({
  sqonPath,
  initialSqon,
  onSubmit,
  onCancel,
  fieldDisplayNameMap,
  opDisplayNameMap,
  ContainerComponent = FilterContainer,
  api = defaultApi,
  field,
  arrangerProjectId = PROJECT_ID,
  arrangerProjectIndex,
  getExecutableSqon,
}) => (
  <ExtendedMappingProvider
    api={api}
    projectId={arrangerProjectId}
    graphqlField={arrangerProjectIndex}
  >
    {({ loading, extendedMapping }) => {
      const fieldExtendedMapping = (extendedMapping || []).find(
        ({ field: _field }) => field === _field,
      );

      // temporary, needs to handle errors too
      const { type } = fieldExtendedMapping || {};
      return ['keyword', 'id'].includes(type) ? (
        <TermFilter
          field={field}
          arrangerProjectId={arrangerProjectId}
          arrangerProjectIndex={arrangerProjectIndex}
          api={api}
          loading={loading}
          sqonPath={sqonPath}
          initialSqon={getExecutableSqon ? getExecutableSqon() : initialSqon}
          onSubmit={onSubmit}
          onCancel={onCancel}
          fieldDisplayNameMap={fieldDisplayNameMap}
          opDisplayNameMap={opDisplayNameMap}
          ContainerComponent={ContainerComponent}
        />
      ) : ['long', 'float', 'integer'].includes(type) ? (
        <RangeFilter
          loading={loading}
          sqonPath={sqonPath}
          initialSqon={getExecutableSqon ? getExecutableSqon() : initialSqon}
          onSubmit={onSubmit}
          onCancel={onCancel}
          fieldDisplayNameMap={fieldDisplayNameMap}
          opDisplayNameMap={opDisplayNameMap}
          ContainerComponent={ContainerComponent}
        />
      ) : (
        <ContainerComponent onSubmit={onSubmit} onCancel={onCancel}>
          {/* Placeholder for unhandled types */}
          <div className="unhandledFieldType">Unhandled field type: {type}</div>
        </ContainerComponent>
      );
    }}
  </ExtendedMappingProvider>
);

FieldOpModifier.prototype = {
  sqonPath: PropTypes.arrayOf(PropTypes.number),
  initialSqon: PropTypes.object,
  onSubmit: PropTypes.func,
  onCancel: PropTypes.func,
  fieldDisplayNameMap: PropTypes.objectOf(PropTypes.string),
  opDisplayNameMap: PropTypes.objectOf(PropTypes.string),
  ContainerComponent: PropTypes.any,
  api: PropTypes.func,
  field: PropTypes.string,
  arrangerProjectId: PropTypes.string,
  arrangerProjectIndex: PropTypes.string.isRequired,
};

export default FieldOpModifier;
