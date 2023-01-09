import {
  Query,
  Arranger,
  Aggregations,
  SQONViewer,
  Table,
} from '@overture-stack/arranger-components';

test('importing @overture-stack/arranger-components modules', () => {
  expect(Query).toBeDefined();
  expect(Arranger).toBeDefined();
  expect(Aggregations).toBeDefined();
  expect(SQONViewer).toBeDefined();
  expect(Table).toBeDefined();
});
