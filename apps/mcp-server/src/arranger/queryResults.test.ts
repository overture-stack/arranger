import assert from 'node:assert/strict';
import { suite, test } from 'node:test';

import { compactHitNodes } from '#arranger/queryResults.js';

suite('compactHitNodes', () => {
	test('strips the top-level edges/node nesting', () => {
		const hits = compactHitNodes({
			edges: [{ node: { id: 'f1' } }, { node: { id: 'f2' } }],
			fieldTypes: { id: 'keyword' },
		});

		assert.deepEqual(hits, [{ id: 'f1' }, { id: 'f2' }]);
	});

	test('returns an empty document for an edge without a node', () => {
		assert.deepEqual(compactHitNodes({ edges: [{}], fieldTypes: {} }), [{}]);
	});

	test('flattens a nested field connection to a plain array of its nodes', () => {
		const hits = compactHitNodes({
			edges: [
				{
					node: {
						id: 'f1',
						donors: { hits: { edges: [{ node: { age: 41 } }, { node: { age: 67 } }] } },
					},
				},
			],
			fieldTypes: { id: 'keyword', donors: 'nested', 'donors.age': 'long' },
		});

		assert.deepEqual(hits, [{ id: 'f1', donors: [{ age: 41 }, { age: 67 }] }]);
	});

	test('flattens doubly nested field connections recursively', () => {
		const hits = compactHitNodes({
			edges: [
				{
					node: {
						donors: {
							hits: {
								edges: [
									{
										node: {
											specimens: { hits: { edges: [{ node: { sample_type: 'Blood' } }] } },
										},
									},
								],
							},
						},
					},
				},
			],
			fieldTypes: { donors: 'nested', 'donors.specimens': 'nested' },
		});

		assert.deepEqual(hits, [{ donors: [{ specimens: [{ sample_type: 'Blood' }] }] }]);
	});

	test('flattens a nested field inside an array of object values', () => {
		const hits = compactHitNodes({
			edges: [
				{
					node: {
						groups: [{ donors: { hits: { edges: [{ node: { age: 12 } }] } } }],
					},
				},
			],
			fieldTypes: { 'groups.donors': 'nested' },
		});

		assert.deepEqual(hits, [{ groups: [{ donors: [{ age: 12 }] }] }]);
	});

	test('passes object fields, scalar arrays, and null nested values through unchanged', () => {
		const hits = compactHitNodes({
			edges: [
				{
					node: {
						donor: { sex: 'Female' },
						tags: ['a', 'b'],
						donors: null,
					},
				},
			],
			fieldTypes: { 'donor.sex': 'keyword', tags: 'keyword', donors: 'nested' },
		});

		assert.deepEqual(hits, [{ donor: { sex: 'Female' }, tags: ['a', 'b'], donors: null }]);
	});
});