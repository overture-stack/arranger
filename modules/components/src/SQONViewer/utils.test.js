import { getValueSQONValues, isWildcardFilter } from './utils.js';

describe('getValueSQONValues', () => {
	it('wraps a bare scalar value in a single-element array', () => {
		expect(getValueSQONValues({ op: 'in', content: { fieldName: 'category', value: 'LOSH' } })).toEqual(['LOSH']);
	});

	it('returns an already-array value unchanged in length, not nested', () => {
		expect(
			getValueSQONValues({ op: 'in', content: { fieldName: 'category', value: ['LOSH', 'TNTS'] } }),
		).toEqual(['LOSH', 'TNTS']);
	});

	it('returns an empty array when value is missing', () => {
		expect(getValueSQONValues({ op: 'in', content: { fieldName: 'category' } })).toEqual([]);
	});

	it('returns an empty array when content itself is missing', () => {
		expect(getValueSQONValues({ op: 'in' })).toEqual([]);
	});
});

describe('isWildcardFilter', () => {
	it('returns true for the canonical "wildcard" op', () => {
		expect(isWildcardFilter('wildcard')).toBe(true);
	});

	it('returns true for the legacy "filter" alias', () => {
		expect(isWildcardFilter('filter')).toBe(true);
	});

	it('returns false for unrelated ops', () => {
		expect(isWildcardFilter('in')).toBe(false);
		expect(isWildcardFilter('and')).toBe(false);
		expect(isWildcardFilter('gt')).toBe(false);
	});
});
