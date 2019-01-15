import React from 'react';
import Component from 'react-component-component';
//$FlowIgnore
import { storiesOf } from '@storybook/react';
import { themeDecorator } from './decorators';
import AdvancedSqonBuilder from '../src/AdvancedSqonBuilder';

storiesOf('AdvancedSqonBuilder', module)
  .addDecorator(themeDecorator)
  .add('Builder', () => {
    const initialState = {
      sqons: [
        {
          op: 'and',
          content: [
            {
              op: 'in',
              content: {
                field: 'kf_id',
                value: ['GF_9V1MT6CM'],
              },
            },
          ],
        },
        {
          op: 'or',
          content: [
            {
              op: 'in',
              content: {
                field: 'participants.diagnoses.diagnosis_category',
                value: ['Cancer'],
              },
            },
            {
              op: 'in',
              content: {
                field: 'participants.phenotype.hpo_phenotype_observed_text',
                value: [
                  'Abnormality of nervous system physiology (HP:0012638)',
                ],
              },
            },
            {
              op: 'in',
              content: {
                field: 'participants.study.short_name',
                value: [
                  'Ewing Sarcoma: Genetic Risk',
                  'Pediatric Brain Tumors: CBTTC',
                ],
              },
            },
          ],
        },
      ],
      activeSqonIndex: 0,
    };
    const onChange = s => ({ sqons }) => {
      s.setState({ sqons });
    };
    const onActiveSqonSelect = s => ({ index }) => {
      s.setState({ activeSqonIndex: index });
    };
    return (
      <Component initialState={initialState}>
        {s => (
          <AdvancedSqonBuilder
            sqons={s.state.sqons}
            activeSqonIndex={s.state.activeSqonIndex}
            onChange={onChange(s)}
            onActiveSqonSelect={onActiveSqonSelect(s)}
            SqonActionComponent={({ sqon, isActive }) => (
              <div>
                <button disabled={!isActive} onClick={() => console.log(sqon)}>
                  custom button 1
                </button>
                <button disabled={!isActive} onClick={() => console.log(sqon)}>
                  custom button 2
                </button>
              </div>
            )}
          />
        )}
      </Component>
    );
  });
