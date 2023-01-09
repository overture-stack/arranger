import Parallel from 'paralleljs';

import { hitsToEdges } from '../../resolveHits';

import nestedFieldNames from './mockData/nestedFieldNames.json';
import expectedEdges from './mockData/wrangledExpectedEdges.json';
import hits from './mockData/wrangledHits.json';

test('hitsToEdges should be acurate', async () => {
  const edges = await hitsToEdges({ hits, nestedFieldNames, Parallel });
  expect(edges).toEqual(expectedEdges);
});

test('hitsToEdges should not block process', async () => {
  let complete = false;
  hitsToEdges({ hits, nestedFieldNames, Parallel }).then(() => (complete = true));
  expect(complete).toEqual(false);
});
