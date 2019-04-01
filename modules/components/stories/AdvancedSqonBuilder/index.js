import React from 'react';
import Component from 'react-component-component';
//$FlowIgnore
import { action } from '@storybook/addon-actions';
import { storiesOf } from '@storybook/react';
import { themeDecorator } from '../decorators';
import AdvancedSqonBuilder from '../../src/AdvancedSqonBuilder';
import TermFilter, {
  TermFilterUI,
} from '../../src/AdvancedSqonBuilder/filterComponents/TermFilter';
import { BooleanFilterUI } from '../../src/AdvancedSqonBuilder/filterComponents/BooleanFilter';
import RangeFilter, {
  RangeFilterUi,
} from '../../src/AdvancedSqonBuilder/filterComponents/RangeFilter';

import {
  sqons as mockSqons,
  fieldDisplayMap as mockFieldDisplayMap,
} from './mocks';
import ProjectsProvider from './ProjectsProvider';

const mockTermBuckets = [
  { doc_count: 2, key: 'GF_9V1MT6CM' },
  { doc_count: 10, key: 'Cancer' },
  { doc_count: 10, key: 'Acute Myeloid Leukemia' },
  {
    doc_count: 10,
    key: 'Abnormality of nervous system physiology (HP:0012638)',
  },
  { doc_count: 10, key: 'Ewing Sarcoma: Genetic Risk' },
  { doc_count: 10, key: 'Pediatric Brain Tumors: CBTTC' },

  { doc_count: 10, key: 'assdfgsdgf' },
  { doc_count: 10, key: 'dhgsd' },
  { doc_count: 10, key: 's;obdfu' },
  { doc_count: 10, key: 'eht;dfnvx' },
  { doc_count: 10, key: ';uegrsndvdfsd' },
  { doc_count: 10, key: 'oisegrbfv' },
  { doc_count: 10, key: '45oihesgdlknv' },
  { doc_count: 10, key: 'oisheglsknvd' },
];

const mockBooleanBuckets = [
  {
    key: '0',
    doc_count: 2580,
    key_as_string: 'false',
  },
  {
    key: '1',
    doc_count: 961,
    key_as_string: 'true',
  },
];

const DemoSqonActionComponent = ({
  sqonIndex,
  isActive,
  isSelected,
  isHoverring,
}) =>
  !(isHoverring || isActive) && (
    <div
      style={{
        position: 'absolute',
        right: 0,
        height: '100%',
      }}
    >
      <div>sqonIndex: {String(sqonIndex)}</div>
      <div>isActive: {String(isActive)}</div>
      <div>isSelected: {String(isSelected)}</div>
      <div>isHoverring: {String(isHoverring)}</div>
    </div>
  );

const DemoModal = ({ onOk = () => {}, onCancel = () => {} }) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: '100%',
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    }}
  >
    <div style={{ background: 'white' }}>
      Will remove stuff!
      <button onClick={onOk}>ok</button>
      <button onClick={onCancel}>cancel</button>
    </div>
  </div>
);

storiesOf('AdvancedSqonBuilder', module)
  .addDecorator(themeDecorator)
  .add('Builder with default delete handler', () => {
    const initialState = {
      activeSqonIndex: 0,
      ModalComponent: null,
      syntheticSqons: mockSqons,
    };
    const onChange = s => data => {
      action('sqons change')(data);
      s.setState({ syntheticSqons: data.newSyntheticSqons });
    };
    const onActiveSqonSelect = s => ({ index, sqonValue }) => {
      action('active sqon select')({ index, sqonValue });
      s.setState({ activeSqonIndex: index });
    };
    const setModal = s => ModalComponent =>
      s.setState({
        ModalComponent,
      });
    return (
      <ProjectsProvider>
        {({ project, index }) => (
          <Component initialState={initialState}>
            {s => (
              <div style={{ position: 'relative', height: '100%' }}>
                <AdvancedSqonBuilder
                  arrangerProjectId={project}
                  arrangerProjectIndex={index}
                  syntheticSqons={s.state.syntheticSqons}
                  activeSqonIndex={s.state.activeSqonIndex}
                  fieldDisplayNameMap={mockFieldDisplayMap}
                  emptyEntryMessage={'Custom empty sqon message'}
                  onChange={onChange(s)}
                  onActiveSqonSelect={onActiveSqonSelect(s)}
                  SqonActionComponent={DemoSqonActionComponent}
                />
                {s.state.ModalComponent ? s.state.ModalComponent() : null}
              </div>
            )}
          </Component>
        )}
      </ProjectsProvider>
    );
  })
  .add('Builder', () => {
    const initialState = {
      activeSqonIndex: 0,
      ModalComponent: null,
      syntheticSqons: mockSqons,
    };
    const onChange = s => data => {
      action('sqons change')(data);
      s.setState({ syntheticSqons: data.newSyntheticSqons });
    };
    const onActiveSqonSelect = s => ({ index, sqonValue }) => {
      action('active sqon select')({ index, sqonValue });
      s.setState({ activeSqonIndex: index });
    };
    const setModal = s => ModalComponent =>
      s.setState({
        ModalComponent,
      });
    return (
      <ProjectsProvider>
        {({ project, index }) => (
          <Component initialState={initialState}>
            {s => (
              <div style={{ position: 'relative', height: '100%' }}>
                <AdvancedSqonBuilder
                  arrangerProjectId={project}
                  arrangerProjectIndex={index}
                  syntheticSqons={s.state.syntheticSqons}
                  activeSqonIndex={s.state.activeSqonIndex}
                  fieldDisplayNameMap={mockFieldDisplayMap}
                  emptyEntryMessage={'Custom empty sqon message'}
                  onChange={onChange(s)}
                  onActiveSqonSelect={onActiveSqonSelect(s)}
                  getSqonDeleteConfirmation={({
                    indexToRemove,
                    dependentIndices,
                  }) =>
                    new Promise((resolve, reject) => {
                      setModal(s)(() => (
                        <DemoModal
                          onOk={() => {
                            setModal(s)(null);
                            resolve();
                          }}
                          onCancel={() => {
                            setModal(s)(null);
                            reject();
                          }}
                        />
                      ));
                    })
                  }
                  SqonActionComponent={DemoSqonActionComponent}
                />
                {s.state.ModalComponent ? s.state.ModalComponent() : null}
              </div>
            )}
          </Component>
        )}
      </ProjectsProvider>
    );
  })
  .add('filters/TermFilter', () => (
    <TermFilterUI
      buckets={mockTermBuckets}
      initialSqon={mockSqons[1]}
      sqonPath={[1]}
      fieldDisplayNameMap={mockFieldDisplayMap}
      onSubmit={action('submitted')}
      onCancel={action('canceled')}
    />
  ))
  .add('filters/TermFilterWithData', () => (
    <ProjectsProvider>
      {({ project, index }) => (
        <TermFilter
          field={'kf_id'}
          arrangerProjectId={project}
          arrangerProjectIndex={index}
          api={undefined}
          initialSqon={mockSqons[0]}
          sqonPath={[0]}
          fieldDisplayNameMap={mockFieldDisplayMap}
          onSubmit={action('submitted')}
          onCancel={action('canceled')}
        />
      )}
    </ProjectsProvider>
  ))
  .add('filters/BooleanFilter', () => {
    return (
      <BooleanFilterUI
        buckets={mockBooleanBuckets}
        initialSqon={mockSqons[3]}
        sqonPath={[1, 1]}
        field={'is_proband'}
        fieldDisplayNameMap={mockFieldDisplayMap}
        onSubmit={action('submitted')}
        onCancel={action('canceled')}
      />
    );
  })
  .add('filters/RangeFilter', () => {
    return (
      <RangeFilterUi
        field={''}
        sqonPath={[1, 2, 0]}
        initialSqon={mockSqons[2]}
        onSubmit={action('submitted')}
        onCancel={action('canceled')}
        fieldDisplayNameMap={mockFieldDisplayMap}
      />
    );
  });
