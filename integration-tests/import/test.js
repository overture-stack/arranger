import {
  Dashboard,
  Query,
  Arranger,
  Aggregations,
  CurrentSQON,
  Table,
  DetectNewVersion,
} from '@arranger/components';

test('importing @arranger modules', () => {
  expect(Dashboard).toBeDefined();
  expect(Query).toBeDefined();
  expect(Arranger).toBeDefined();
  expect(Aggregations).toBeDefined();
  expect(CurrentSQON).toBeDefined();
  expect(Table).toBeDefined();
  expect(DetectNewVersion).toBeDefined();
});
