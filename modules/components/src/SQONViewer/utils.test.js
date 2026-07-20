import { isWildcardFilter } from './utils.js';

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
