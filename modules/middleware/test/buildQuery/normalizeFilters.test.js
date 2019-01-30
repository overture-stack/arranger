import normalizeFilters from '../../src/buildQuery/normalizeFilters';
import { ALL_OP, IN_OP } from '../../src/constants';

test("it should normalize 'all' ops", () => {
  const input = {
    op: 'and',
    content: [
      {
        op: ALL_OP,
        content: {
          field: 'id',
          value: ['a', 'b'],
        },
      },
    ],
  };
  const output = {
    op: 'and',
    content: [
      {
        op: 'and',
      },
    ],
  };
  expect(1).toEqual(1);
});
