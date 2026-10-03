import { removeClauseIfCleared, removeSqonAtIndex, removeSqonPath } from './utils.js';

const clause = (fieldName, value) => ({ content: { fieldName, value: [value] }, op: 'in' });
const X = clause('kind', 'a');
const Y = clause('kind', 'b');
const Z = clause('kind', 'c');

// An emptied group would mean every document, so deleting a group's last condition removes the group too.
describe('removeSqonPath', () => {
	it('removes a group under and once its last condition is deleted', () => {
		// Given a query whose second entry is a group holding one condition
		const sqon = { content: [X, { content: [Y], op: 'or' }], op: 'and' };

		// When that condition is deleted, Then the group goes with it
		expect(removeSqonPath([1, 0])(sqon)).toEqual({ content: [X], op: 'and' });
	});

	it('removes a group under or once its last condition is deleted', () => {
		const sqon = { content: [X, { content: [Y], op: 'and' }], op: 'or' };

		expect(removeSqonPath([1, 0])(sqon)).toEqual({ content: [X], op: 'or' });
	});

	it('removes a group under not once its last condition is deleted', () => {
		const sqon = { content: [X, { content: [Y], op: 'not' }], op: 'and' };

		expect(removeSqonPath([1, 0])(sqon)).toEqual({ content: [X], op: 'and' });
	});

	it('removes every group the deletion empties, two levels up', () => {
		// Given a condition alone inside a group that is alone inside another group
		const sqon = { content: [X, { content: [{ content: [Y], op: 'and' }], op: 'or' }], op: 'and' };

		// When it is deleted, Then both emptied groups go, leaving the root's other entry
		expect(removeSqonPath([1, 0, 0])(sqon)).toEqual({ content: [X], op: 'and' });
	});

	it('keeps a group that still holds a condition', () => {
		const sqon = { content: [X, { content: [Y, Z], op: 'or' }], op: 'and' };

		expect(removeSqonPath([1, 0])(sqon)).toEqual({ content: [X, { content: [Z], op: 'or' }], op: 'and' });
	});

	it('leaves an emptied root in place, for the builder to remove the whole query', () => {
		// Given a query holding one condition at the root
		const sqon = { content: [X], op: 'and' };

		// When it is deleted, Then the root remains, empty, as the builder expects
		expect(removeSqonPath([0])(sqon)).toEqual({ content: [], op: 'and' });
	});
});

// Clearing a term filter means removing its condition: an in with no values would make an and match nothing.
describe('removeClauseIfCleared', () => {
	const cleared = { content: { fieldName: 'kind', value: [] }, op: 'in' };

	it('removes a cleared clause, and the group it empties, through the same path as deletion', () => {
		// Given a cleared clause alone in a group beside another condition
		const sqon = { content: [X, { content: [cleared], op: 'or' }], op: 'and' };

		// When it is submitted, Then the clause and its emptied group are gone
		expect(removeClauseIfCleared([1, 0])(sqon)).toEqual({ content: [X], op: 'and' });
	});

	it('keeps a clause that still holds values', () => {
		const sqon = { content: [X, { content: [Y], op: 'or' }], op: 'and' };

		expect(removeClauseIfCleared([1, 0])(sqon)).toBe(sqon);
	});

	it('leaves an emptied root in place, for the builder to remove the whole query', () => {
		expect(removeClauseIfCleared([0])({ content: [cleared], op: 'and' })).toEqual({ content: [], op: 'and' });
	});

	it('leaves a root clause in place, since there is no group to remove it from', () => {
		expect(removeClauseIfCleared([])(cleared)).toBe(cleared);
	});
});

// A query a deletion empties would read as every document wherever another query refers to it, so
// references to it go too, as the removed query's own references do.
describe('removeSqonAtIndex', () => {
	const union = (...indices) => ({ content: indices, op: 'or' });
	// The builder holds every query as a group, its conditions inside.
	const queryX = { content: [X], op: 'and' };
	const queryY = { content: [Y], op: 'and' };

	it('removes references to a query that the deletion empties', () => {
		// Given X, Y, a union of Y alone, and a union of X with that union
		const sqons = [queryX, queryY, union(1), union(0, 2)];

		// When Y is deleted
		const remaining = removeSqonAtIndex(1, sqons);

		// Then the emptied union stays in the list, and the outer union no longer refers to it
		expect(remaining).toEqual([queryX, union(), union(0)]);
	});

	it('removes references in turn up a chain of queries each emptied by the last', () => {
		const sqons = [queryX, queryY, union(1), union(2), union(0, 3)];

		expect(removeSqonAtIndex(1, sqons)).toEqual([queryX, union(), union(), union(0)]);
	});

	it('keeps references to a query that still holds an operand', () => {
		const sqons = [queryX, queryY, union(0, 1), union(2, 0)];

		expect(removeSqonAtIndex(1, sqons)).toEqual([queryX, union(0), union(1, 0)]);
	});
});
