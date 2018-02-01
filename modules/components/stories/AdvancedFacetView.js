import React from 'react';
import { storiesOf } from '@storybook/react';
import { mappingToDisplayTreeData } from '@arranger/mapping-utils';
import { themeDecorator } from './decorators';
import AdvancedFacetView from '../src/AdvancedFacetView';
import elasticMockMapping from '../src/AdvancedFacetView/elasticMockMapping';

const { elasticMappingToDisplayTreeData } = mappingToDisplayTreeData;

storiesOf('AdvancedFacetView', module)
  .addDecorator(themeDecorator)
  .add('AdvancedFacetView', () => (
    <AdvancedFacetView elasticMapping={elasticMockMapping} />
  ));
