import React from 'react';
import PropTypes from 'prop-types';
import TermFilter from './TermFilter';
import RangeFilter from './RangeFilter';
import BooleanFilter from './BooleanFilter';
import ExtendedMappingProvider from '../../utils/ExtendedMappingProvider';
import { default as defaultApi } from '../../utils/api';
import { FilterContainer } from './common';

export { default as TermFilter } from './TermFilter';
export { default as RangeFilter } from './RangeFilter';
export { default as BooleanFilter } from './BooleanFilter';

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
  arrangerIndex,
  getExecutableSqon = () => initialSqon,
}) => (
  <ExtendedMappingProvider api={api} graphqlField={arrangerIndex} field={field}>
    {({ loading, extendedMapping }) => {
      const fieldExtendedMapping = (extendedMapping || []).find(
        ({ field: _field }) => field === _field,
      );

      // temporary, needs to handle errors too
      const { type, unit } = fieldExtendedMapping || {};
      return ['keyword', 'id'].includes(type) ? (
        <TermFilter
          field={field}
          arrangerIndex={arrangerIndex}
          api={api}
          loading={loading}
          sqonPath={sqonPath}
          initialSqon={initialSqon}
          executableSqon={getExecutableSqon()}
          onSubmit={onSubmit}
          onCancel={onCancel}
          fieldDisplayNameMap={fieldDisplayNameMap}
          opDisplayNameMap={opDisplayNameMap}
          ContainerComponent={ContainerComponent}
        />
      ) : ['long', 'float', 'integer', 'date'].includes(type) ? (
        <RangeFilter
          field={field}
          loading={loading}
          sqonPath={sqonPath}
          initialSqon={initialSqon}
          executableSqon={getExecutableSqon()}
          onSubmit={onSubmit}
          onCancel={onCancel}
          fieldDisplayNameMap={fieldDisplayNameMap}
          opDisplayNameMap={opDisplayNameMap}
          ContainerComponent={ContainerComponent}
          unit={unit}
        />
      ) : ['boolean'].includes(type) ? (
        <BooleanFilter
          field={field}
          api={api}
          arrangerIndex={arrangerIndex}
          sqonPath={sqonPath}
          initialSqon={initialSqon}
          executableSqon={getExecutableSqon()}
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
  arrangerIndex: PropTypes.string.isRequired,
  getExecutableSqon: PropTypes.func,
};

export default FieldOpModifier;
