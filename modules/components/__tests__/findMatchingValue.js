import { findMatchingValues } from '../src/Arranger/QuickSearch/QuickSearchQuery';

test('findMatchingValues', () => {
  expect(
    findMatchingValues({ item: { name: 'BRAF' }, searchText: 'BRAF' }),
  ).toEqual('BRAF');

  expect(
    findMatchingValues({
      item: { name: 'blah', variants: [{ name: 'BRAF' }] },
      searchText: 'BRAF',
    }),
  ).toEqual('BRAF');

  expect(
    findMatchingValues({
      item: { name: 'blah', variants: [{ name: 'blah2', genes: ['BRAF'] }] },
      searchText: 'BRAF',
    }),
  ).toEqual('BRAF');

  expect(
    findMatchingValues({
      item: {
        name: 'blah',
        variants: [{ name: 'blah2', genes: ['blah3', 'BRAF'] }],
      },
      searchText: 'BRAF',
    }),
  ).toEqual('BRAF');

  expect(
    findMatchingValues({
      item: {
        name: 'blah',
        variants: [{ name: 'blah2', genes: ['blah3', 'BRAF'] }],
      },
      searchText: 'BR',
    }),
  ).toEqual('BRAF');

  expect(
    findMatchingValues({
      item: {
        name: 'blah',
        variants: [{ name: 'blah2', genes: ['blah3', 'BRAF'] }],
      },
      searchText: 'b',
    }),
  ).toEqual('blah');

  expect(
    findMatchingValues({
      item: {
        name: 'blah',
        variants: [{ name: 'blah2', genes: ['blah3', 'BRAF'] }],
      },
      searchText: 'B',
    }),
  ).toEqual('blah');
});
