import React from 'react';
import Component from 'react-component-component';
//$FlowIgnore
import { action } from '@storybook/addon-actions';
import { storiesOf } from '@storybook/react';
import { themeDecorator } from '../decorators';
import AdvancedSqonBuilder, { TermFilter } from '../../src/AdvancedSqonBuilder';
import {
  sqons as mockSqons,
  fieldDisplayMap as mockFieldDisplayMap,
} from './mocks';

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
  .add('Builder', () => {
    const initialState = {
      activeSqonIndex: 0,
      ModalComponent: null,
      syntheticSqons: mockSqons,
    };
    const onChange = s => ({ newSyntheticSqons, sqonValues }) => {
      action('sqons change')({ newSyntheticSqons, sqonValues });
      s.setState({ syntheticSqons: newSyntheticSqons });
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
      <Component initialState={initialState}>
        {s => (
          <div style={{ position: 'relative', height: '100%' }}>
            <AdvancedSqonBuilder
              syntheticSqons={s.state.syntheticSqons}
              activeSqonIndex={s.state.activeSqonIndex}
              fieldDisplayNameMap={mockFieldDisplayMap}
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
    );
  })
  .add('filters/TermFilter', () => {
    return (
      <TermFilter
        sqonPath={[1]}
        initialSqon={mockSqons[1]}
        onSubmit={action('submitted')}
        onCancel={action('canceled')}
        fieldDisplayNameMap={mockFieldDisplayMap}
      />
    );
  })
  .add('filters/Booleanfilter', () => {
    return <div>add Booleanfilter</div>;
  })
  .add('filters/RangeFilter', () => {
    return <div>add RangeFilter</div>;
  });
