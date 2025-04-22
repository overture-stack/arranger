import assert from 'node:assert';
import { test } from 'node:test';

import { print } from 'graphql';
import gql from 'graphql-tag';

export default ({ api, documentType, gqlPath }) => {
	test('1.reads hits with sqon properly', async () => {
		const { data } = await api
			.post({
				endpoint: gqlPath,
				body: {
					query: print(gql`
					{
						${documentType} {
							hits(
								filters: {
									content: [
										{
											content: {
												fieldName: "clinical_diagnosis.clinical_stage_grouping",
												value: "Stage I"
											}
											op: "in",
										}
									]
									op: "and",
								}
							) {
								edges {
									node {
										id
									}
								}
								total
							}
						}
					}
				`),
				},
			})
			.catch((err) => {
				console.log('readSearchData error', err);
			});

		assert.deepEqual(data, {
			data: {
				[documentType]: {
					hits: {
						edges: [
							{ node: { id: 'sagsdhertdfdgsdfgsdfg' } },
							{ node: { id: '5da62fbad545d210fe1c63a9' } },
						],
						total: 2,
					},
				},
			},
		});
	});

	test('2.paginates hits properly', async () => {
		assert.deepEqual(
			await api
				.post({
					endpoint: gqlPath,
					body: {
						query: print(gql`
							{
								${documentType} {
									hits (first: 1, offset: 0) {
										edges {
											node {
												id
											}
										}
										total
									}
								}
							}
						`),
					},
				})
				.then(({ data } = { data: '' }) => data)
				.catch((err) => {
					console.log('readSearchData error', err);
				}),
			{
				data: {
					[documentType]: {
						hits: {
							edges: [
								{
									node: {
										id: 'sagsdhertdfdgsdfgsdfg',
									},
								},
							],
							total: 3,
						},
					},
				},
			},
		);

		assert.deepEqual(
			await api
				.post({
					endpoint: gqlPath,
					body: {
						query: print(gql`
							{
								${documentType} {
									hits (first: 1, offset: 1) {
										edges {
											node {
												id
											}
										}
										total
									}
								}
							}
						`),
					},
				})
				.then(({ data } = { data: '' }) => data)
				.catch((err) => {
					console.log('readSearchData error', err);
				}),
			{
				data: {
					[documentType]: {
						hits: {
							edges: [
								{
									node: {
										id: '5da62fbad545d210fe1c63a9',
									},
								},
							],
							total: 3,
						},
					},
				},
			},
		);

		assert.deepEqual(
			await api
				.post({
					endpoint: gqlPath,
					body: {
						query: print(gql`
							{
								${documentType} {
									hits (first: 2, offset: 0) {
										edges {
											node {
												id
											}
										}
										total
									}
								}
							}
						`),
					},
				})
				.then(({ data } = { data: '' }) => data)
				.catch((err) => {
					console.log('readSearchData error', err);
				}),
			{
				data: {
					[documentType]: {
						hits: {
							edges: [
								{
									node: {
										id: 'sagsdhertdfdgsdfgsdfg',
									},
								},
								{
									node: {
										id: '5da62fbad545d210fe1c63a9',
									},
								},
							],
							total: 3,
						},
					},
				},
			},
		);

		assert.deepEqual(
			await api
				.post({
					endpoint: gqlPath,
					body: {
						query: print(gql`
							{
								${documentType} {
									hits (first: 2, offset: 1) {
										edges {
											node {
												id
											}
										}
										total
									}
								}
							}
						`),
					},
				})
				.then(({ data } = { data: '' }) => data)
				.catch((err) => {
					console.log('readSearchData error', err);
				}),
			{
				data: {
					[documentType]: {
						hits: {
							edges: [
								{
									node: {
										id: '5da62fbad545d210fe1c63a9',
									},
								},
								{
									node: {
										id: '5dc9b6c3d614630f9809f7d0',
									},
								},
							],
							total: 3,
						},
					},
				},
			},
		);
	});

	test('3.excludes access_denied files', async () => {
		const { data } = await api
			.post({
				endpoint: gqlPath,
				body: {
					query: print(gql`
						{
							${documentType} {
								hits(first: 1000) {
									edges {
										node {
											access_denied
										}
									}
								}
							}
						}
				`),
				},
			})
			.catch((err) => {
				console.log('readSearchData error', err);
			});

		assert.deepEqual(
			data?.data?.[documentType]?.hits?.edges?.every((edge) => !edge.node.access_denied),
			true,
		);
	});

	test('4.cannot request for access_denied item', async () => {
		const { data } = await api
			.post({
				endpoint: gqlPath,
				body: {
					variables: {
						sqon: {
							content: [
								{
									content: {
										fieldName: 'access_denied',
										value: ['true'],
									},
									op: 'in',
								},
							],
							op: 'and',
						},
					},
					query: print(gql`
					query ($sqon: JSON) {
						${documentType} {
							hits(first: 1000, filters: $sqon) {
								edges {
									node {
										access_denied
									}
								}
							}
						}
					}
				`),
				},
			})
			.catch((err) => {
				console.log('readSearchData error', err);
			});

		assert.deepEqual(data?.data?.[documentType]?.hits?.edges?.length, 0);
	});
};
