import {
  Dashboard,
  Query,
  Arranger,
  Aggregations,
  CurrentSQON,
  Table,
} from '@arranger/components';

test('importing @arranger/components modules', () => {
  expect(Dashboard).toBeDefined();
  expect(Query).toBeDefined();
  expect(Arranger).toBeDefined();
  expect(Aggregations).toBeDefined();
  expect(CurrentSQON).toBeDefined();
  expect(Table).toBeDefined();
});
