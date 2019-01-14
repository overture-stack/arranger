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
          op: 'and',
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
      selectedIndex: 0,
    };
    const onSqonsChange = s => ({ sqons }) => {
      s.setState({ sqons });
    };
    return (
      <Component initialState={initialState}>
        {s => (
          <AdvancedSqonBuilder
            sqons={s.state.sqons}
            onSqonsChange={onSqonsChange(s)}
            activeSqonIndex={s.state.selectedIndex}
            SqonActionComponent={({ sqon }) => (
              <div>
                <button onClick={() => console.log(sqon)}>DELETE!!!</button>
                <button onClick={() => console.log(sqon)}>SAVE!!!</button>
              </div>
            )}
          />
        )}
      </Component>
    );
  });
