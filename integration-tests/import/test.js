import {
  Dashboard,
  Query,
  Arranger,
  Aggregations,
  CurrentSQON,
  Table,
} from '@kfarranger/components';

test('importing @kfarranger modules', () => {
  expect(Dashboard).toBeDefined();
  expect(Query).toBeDefined();
  expect(Arranger).toBeDefined();
  expect(Aggregations).toBeDefined();
  expect(CurrentSQON).toBeDefined();
  expect(Table).toBeDefined();
});
