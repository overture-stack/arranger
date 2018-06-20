import hits from './mockData/wrangledHits.json';
import nestedFields from './mockData/nestedFields.json';
import expectedEdges from './mockData/wrangledExpectedEdges.json';
import { hitsToEdges } from '../../src/resolveHits';
import Parallel from 'paralleljs';

test('hitsToEdges should be acurate', async () => {
  const edges = await hitsToEdges({ hits, nestedFields, Parallel });
  expect(edges).toEqual(expectedEdges);
});

test('hitsToEdges should not block process', async () => {
  let complete = false;
  hitsToEdges({ hits, nestedFields, Parallel }).then(() => (complete = true));
  expect(complete).toEqual(false);
});
