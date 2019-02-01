import React from 'react';
import TermFilter from './TermFilter';
import RangeFilter from './RangeFilter';
import ExtendedMappingProvider from '../../utils/ExtendedMappingProvider';
import { default as defaultApi } from '../../utils/api';
import { PROJECT_ID } from '../../utils/config';

export { default as TermFilter } from './TermFilter';
export { default as RangeFilter } from './RangeFilter';

const mockExtendedMapping = [
  {
    field: 'participants.diagnoses.diagnosis_category',
    type: 'keyword',
  },
  {
    field: 'participants.phenotype.hpo_phenotype_observed_text',
    type: 'keyword',
  },
  {
    field: 'participants.study.short_name',
    type: 'keyword',
  },
  {
    field: 'kf_id',
    type: 'keyword',
  },
  {
    field: 'size',
    type: 'integer',
  },
];

export default ({
  sqonPath,
  initialSqon,
  onSubmit,
  onCancel,
  fieldDisplayNameMap,
  opDisplayNameMap,
  ContainerComponent = undefined,
  api = defaultApi,
  field,
  arrangerProjectId = PROJECT_ID,
  arrangerProjectIndex,
}) => (
  <ExtendedMappingProvider
    api={api}
    projectId={arrangerProjectId}
    graphqlField={arrangerProjectIndex}
  >
    {({ loading, extendedMapping }) => {
      console.log('extendedMapping: ', extendedMapping);
      const fieldExtendedMapping = (extendedMapping || []).find(
        ({ field: _field }) => field === _field,
      );
      const { type } = fieldExtendedMapping || {};
      console.log('fieldExtendedMapping: ', fieldExtendedMapping);
      return ['keyword', 'id'].includes(type) ? (
        <TermFilter
          field={field}
          arrangerProjectId={arrangerProjectId}
          arrangerProjectIndex={arrangerProjectIndex}
          api={api}
          loading={loading}
          sqonPath={sqonPath}
          initialSqon={initialSqon}
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
          initialSqon={initialSqon}
          onSubmit={onSubmit}
          onCancel={onCancel}
          fieldDisplayNameMap={fieldDisplayNameMap}
          opDisplayNameMap={opDisplayNameMap}
          ContainerComponent={ContainerComponent}
        />
      ) : (
        <div>some other component will go here</div>
      );
    }}
  </ExtendedMappingProvider>
);
