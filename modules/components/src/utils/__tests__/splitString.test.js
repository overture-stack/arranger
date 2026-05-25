import splitString from '#utils/splitString.js';

describe('splitString', () => {
	it('1.splits on configured delimiters by default', () => {
		expect(splitString({ str: 'apple, pear, banana' })).toEqual(['apple', 'pear', 'banana']);
	});

	it('2.splits on whitespace and commas when configured that way', () => {
		expect(splitString({ str: 'apple pear,banana', split: ['\\s', ','] })).toEqual(['apple', 'pear', 'banana']);
	});

	it('3.preserves quoted phrases as a single token', () => {
		expect(splitString({ str: 'apple "red pear" banana', split: ['\\s', ','] })).toEqual([
			'apple',
			'red pear',
			'banana',
		]);
	});

	it('4.preserves delimiters inside quoted phrases', () => {
		expect(splitString({ str: 'apple "red, ripe pear" banana', split: ['\\s', ','] })).toEqual([
			'apple',
			'red, ripe pear',
			'banana',
		]);
	});

	it('5.supports a fully quoted exact token', () => {
		expect(
			splitString({
				str: '"19163_SKY02-23Mar31_covN1_1_2_2023-04-03 + 19166_SKY02-23Mar31_covN2_1_2_2023-04-03 + 19169_SKY02-23Mar31_nPMMoV_1_2_2023-04-03"',
				split: ['\\s', ','],
			}),
		).toEqual([
			'19163_SKY02-23Mar31_covN1_1_2_2023-04-03 + 19166_SKY02-23Mar31_covN2_1_2_2023-04-03 + 19169_SKY02-23Mar31_nPMMoV_1_2_2023-04-03',
		]);
	});

	it('6.ignores empty fragments around repeated delimiters', () => {
		expect(splitString({ str: 'apple,,  pear', split: ['\\s', ','] })).toEqual(['apple', 'pear']);
	});
});
