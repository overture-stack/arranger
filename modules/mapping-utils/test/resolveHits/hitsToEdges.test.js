import hits from './mockData/wrangledHits.json';
import nestedFields from './mockData/nestedFields.json';
import expectedEdges from './mockData/wrangledExpectedEdges.json';
import { hitsToEdges } from '../../src/resolveHits';

test('hitsToEdges should be acurate', async () => {
  const edges = await hitsToEdges({ hits, nestedFields });
  expect(edges).toEqual(expectedEdges);
});
