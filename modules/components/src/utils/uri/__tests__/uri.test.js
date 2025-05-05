import { parseIntParam, parseSQONParam } from '#utils/uri/index.js';

describe('parseIntParam', () => {
	it('1.should handle strings', () => {
		expect(parseIntParam('1', 0)).toBe(1);
	});
	it('2.should prevent negative numbers', () => {
		expect(parseIntParam('-1', 0)).toBe(0);
	});
	it('3.should handle defaults', () => {
		expect(parseIntParam(null, 10)).toBe(10);
	});
});
describe('parseSQONParam', () => {
	it('1.should handle defaults', () => {
		const obj = { op: 'and', content: [] };
		expect(parseSQONParam(null, obj)).toBe(obj);
	});
});
