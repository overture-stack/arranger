import { isThemeEqual, mergeThemes, updateThemeContribution } from './utils.js';

describe('mergeThemes', () => {
	it('merges plain object values additively, same as a normal deep merge', () => {
		const result = mergeThemes({ components: { Table: { hideLoader: true } } }, { components: { Table: { background: 'white' } } });

		expect(result).toEqual({ components: { Table: { background: 'white', hideLoader: true } } });
	});

	it('replaces an array value wholesale rather than merging it by index', () => {
		const target = { components: { Table: { defaultSorting: [{ fieldName: 'a' }, { fieldName: 'b' }] } } };
		const partial = { components: { Table: { defaultSorting: [{ fieldName: 'c' }] } } };

		const result = mergeThemes(target, partial);

		expect(result.components?.Table?.defaultSorting).toEqual([{ fieldName: 'c' }]);
	});

	it('replaces an array with a shorter one instead of leaving stale trailing elements', () => {
		const target = { components: { Table: { defaultSorting: [{ fieldName: 'a' }, { fieldName: 'b' }] } } };
		const partial = { components: { Table: { defaultSorting: [{ fieldName: 'a' }] } } };

		const result = mergeThemes(target, partial);

		expect(result.components?.Table?.defaultSorting).toEqual([{ fieldName: 'a' }]);
	});

	it('applies a processor function against the target theme and uses its return value', () => {
		const target = { colors: { common: { white: '#fff' } } };

		const result = mergeThemes(target, (inputTheme: any) => ({
			...inputTheme,
			colors: { ...inputTheme.colors, common: { ...inputTheme.colors.common, black: '#000' } },
		}));

		expect(result).toEqual({ colors: { common: { black: '#000', white: '#fff' } } });
	});

	it('folds an array of partial themes in order, later entries overriding earlier ones', () => {
		const target = { colors: { common: { white: '#fff' } } };

		const result = mergeThemes(target, [{ colors: { common: { black: '#000' } } }, { colors: { common: { black: '#111' } } }]);

		expect(result).toEqual({ colors: { common: { black: '#111', white: '#fff' } } });
	});
});

describe('isThemeEqual', () => {
	it('treats two different function references as equal', () => {
		const a = { components: { Table: { DownloadButton: { label: () => 'Download' } } } };
		const b = { components: { Table: { DownloadButton: { label: () => 'Download' } } } };

		expect(isThemeEqual(a, b)).toBe(true);
	});

	it('still detects a real structural difference elsewhere, even when a function value is also present', () => {
		const a = { components: { Table: { DownloadButton: { label: () => 'Download' } }, hideLoader: true } };
		const b = { components: { Table: { DownloadButton: { label: () => 'Download' } }, hideLoader: false } };

		expect(isThemeEqual(a, b)).toBe(false);
	});

	it('detects a removed key as a real difference', () => {
		const a = { components: { Table: { defaultSorting: [{ fieldName: 'a' }] } } };
		const b = { components: { Table: {} } };

		expect(isThemeEqual(a, b)).toBe(false);
	});

	it('detects a shrunk array as a real difference', () => {
		const a = { components: { Table: { defaultSorting: [{ fieldName: 'a' }, { fieldName: 'b' }] } } };
		const b = { components: { Table: { defaultSorting: [{ fieldName: 'a' }] } } };

		expect(isThemeEqual(a, b)).toBe(false);
	});
});

describe('updateThemeContribution', () => {
	it("replaces a caller's own contribution wholesale rather than merging into it", () => {
		const contributions = { RepoTable: { components: { Table: { defaultSorting: [{ fieldName: 'a' }, { fieldName: 'b' }] } } } };

		const result = updateThemeContribution(contributions, 'RepoTable', { components: { Table: {} } });

		expect(result.RepoTable).toEqual({ components: { Table: {} } });
	});

	it('returns the exact same reference when the caller contributes an unchanged value, to let a React state updater bail out', () => {
		const sameValue = { components: { Table: { hideLoader: true } } };
		const contributions = { RepoTable: sameValue };

		const result = updateThemeContribution(contributions, 'RepoTable', { components: { Table: { hideLoader: true } } });

		expect(result).toBe(contributions);
	});

	it('returns a new reference when the caller contributes a changed value', () => {
		const contributions = { RepoTable: { components: { Table: { hideLoader: true } } } };

		const result = updateThemeContribution(contributions, 'RepoTable', { components: { Table: { hideLoader: false } } });

		expect(result).not.toBe(contributions);
	});

	it('keeps other callers untouched when one caller updates its contribution', () => {
		const contributions = {
			BubbleColor: { colors: { common: { black: '#000' } } },
			RepoTable: { colors: { common: { white: '#fff' } } },
		};

		const result = updateThemeContribution(contributions, 'RepoTable', { colors: { common: { white: '#eee' } } });

		expect(result.BubbleColor).toBe(contributions.BubbleColor);
	});
});

describe('registry + fold together (the actual bug this file exists to fix)', () => {
	it("reflects a caller's later, smaller contribution instead of leaving the earlier, larger one merged in forever", () => {
		const baseTheme = {};

		// RepoTable first renders with an explicit defaultSorting...
		const contributionsAfterFirstRender = updateThemeContribution({}, 'RepoTable', {
			components: { Table: { defaultSorting: [{ fieldName: 'donors.submitter_donor_id' }] } },
		});
		const firstTheme = mergeThemes(baseTheme, Object.values(contributionsAfterFirstRender));
		expect(firstTheme.components?.Table?.defaultSorting).toEqual([{ fieldName: 'donors.submitter_donor_id' }]);

		// ...then RepoTable re-renders having removed defaultSorting from its config entirely.
		const contributionsAfterSecondRender = updateThemeContribution(contributionsAfterFirstRender, 'RepoTable', {
			components: { Table: {} },
		});
		const secondTheme = mergeThemes(baseTheme, Object.values(contributionsAfterSecondRender));

		expect(secondTheme.components?.Table?.defaultSorting).toBeUndefined();
	});
});
