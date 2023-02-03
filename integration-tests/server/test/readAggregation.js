import { expect } from 'chai';
import { print } from 'graphql';
import gql from 'graphql-tag';
import orderBy from 'lodash/orderBy';

export default ({ api, documentType, gqlPath }) => {
	it('1.reads aggregations properly', async () => {
		const { data } = await api
			.post({
				endpoint: gqlPath,
				body: {
					query: print(gql`
					{
						${documentType} {
							aggregations {
								clinical_diagnosis__clinical_stage_grouping {
									buckets {
										doc_count
										key
									}
								}
							}
						}
					}
				`),
				},
			})
			.catch((err) => {
				console.log('readAggregation error', err);
			});

		expect(data).to.eql({
			data: {
				model: {
					aggregations: {
						clinical_diagnosis__clinical_stage_grouping: {
							buckets: [
								{
									doc_count: 2,
									key: 'Stage I',
								},
								{
									doc_count: 1,
									key: '__missing__',
								},
							],
						},
					},
				},
			},
		});
	});

	it('2.reads aggregations with sqon properly', async () => {
		const { data } = await api
			.post({
				endpoint: gqlPath,
				body: {
					query: print(gql`
					{
						${documentType} {
							aggregations(
								aggregations_filter_themselves: true
								filters: {
									content: [
										{
											content: {
												fieldName: "clinical_diagnosis.clinical_stage_grouping",
												value: "Stage I"
											},
											op: "in",
										}
									],
									op: "and",
								},
							) {
								clinical_diagnosis__clinical_stage_grouping {
									buckets {
										doc_count
										key
									}
								}
							}
						}
					}
				`),
				},
			})
			.catch((err) => {
				console.log('readAggregation error', err);
			});

		expect({
			data: {
				[documentType]: {
					aggregations: {
						clinical_diagnosis__clinical_stage_grouping: {
							buckets: orderBy(
								data.data[documentType].aggregations.clinical_diagnosis__clinical_stage_grouping
									.buckets,
								'key',
							),
						},
					},
				},
			},
		}).to.eql({
			data: {
				[documentType]: {
					aggregations: {
						clinical_diagnosis__clinical_stage_grouping: {
							buckets: [
								{
									doc_count: 2,
									key: 'Stage I',
								},
							],
						},
					},
				},
			},
		});
	});

	it('3.should work with prefix filter sqon', async () => {
		const { data } = await api
			.post({
				endpoint: gqlPath,
				body: {
					query: print(gql`
					{
						${documentType} {
							aggregations(
								aggregations_filter_themselves: true
								filters: {
									content: [
										{
											content: {
												fieldNames: [
													"name",
													"primary_site",
													"clinical_diagnosis.clinical_tumor_diagnosis",
													"gender",
													"race"
												]
												value: "Colorectal*"
											}
											op: "filter"
										}
									]
									op: "and"
								},
							) {
								clinical_diagnosis__clinical_stage_grouping {
									buckets {
										doc_count
										key
									}
								}
							}
						}
					}
				`),
				},
			})
			.catch((err) => {
				console.log('readAggregation error', err);
			});

		expect({
			data: {
				[documentType]: {
					aggregations: {
						clinical_diagnosis__clinical_stage_grouping: {
							buckets: orderBy(
								data.data[documentType].aggregations.clinical_diagnosis__clinical_stage_grouping
									.buckets,
								'key',
							),
						},
					},
				},
			},
		}).to.eql({
			data: {
				[documentType]: {
					aggregations: {
						clinical_diagnosis__clinical_stage_grouping: {
							buckets: [
								{
									doc_count: 2,
									key: 'Stage I',
								},
							],
						},
					},
				},
			},
		});
	});

	it('4.should work with postfix filter sqon', async () => {
		const { data } = await api
			.post({
				endpoint: gqlPath,
				body: {
					query: print(gql`
					{
						${documentType} {
							aggregations(
								aggregations_filter_themselves: true
								filters: {
									content: [
										{
											content: {
												fieldNames: [
													"name",
													"primary_site",
													"clinical_diagnosis.clinical_tumor_diagnosis",
													"gender",
													"race"
												],
												value: "*cancer"
											}
											op: "filter",
										}
									],
									op: "and",
								},
							) {
								clinical_diagnosis__clinical_stage_grouping {
									buckets {
										doc_count
										key
									}
								}
							}
						}
					}
				`),
				},
			})
			.catch((err) => {
				console.log('readAggregation error', err);
			});

		expect({
			data: {
				[documentType]: {
					aggregations: {
						clinical_diagnosis__clinical_stage_grouping: {
							buckets: orderBy(
								data.data[documentType].aggregations.clinical_diagnosis__clinical_stage_grouping
									.buckets,
								'key',
							),
						},
					},
				},
			},
		}).to.eql({
			data: {
				[documentType]: {
					aggregations: {
						clinical_diagnosis__clinical_stage_grouping: {
							buckets: [
								{
									doc_count: 2,
									key: 'Stage I',
								},
							],
						},
					},
				},
			},
		});
	});

	it('5.should work with pre and post-fix filter sqon', async () => {
		const { data } = await api
			.post({
				endpoint: gqlPath,
				body: {
					query: print(gql`
					{
						${documentType} {
							aggregations(
								filters: {
									content: [
										{
											content: {
												fieldNames: [
													"name",
													"primary_site",
													"clinical_diagnosis.clinical_tumor_diagnosis",
													"gender",
													"race"
												],
												value: "*SOMEONE*"
											}
											op: "filter"
										}
									]
									op: "and"
								},
								aggregations_filter_themselves: true
							) {
								clinical_diagnosis__clinical_stage_grouping {
									buckets {
										doc_count
										key
									}
								}
							}
						}
					}
				`),
				},
			})
			.catch((err) => {
				console.log('readAggregation error', err);
			});

		expect({
			data: {
				[documentType]: {
					aggregations: {
						clinical_diagnosis__clinical_stage_grouping: {
							buckets: orderBy(
								data.data[documentType].aggregations.clinical_diagnosis__clinical_stage_grouping
									.buckets,
								'key',
							),
						},
					},
				},
			},
		}).to.eql({
			data: {
				[documentType]: {
					aggregations: {
						clinical_diagnosis__clinical_stage_grouping: {
							buckets: [
								{
									doc_count: 2,
									key: 'Stage I',
								},
							],
						},
					},
				},
			},
		});
	});

	it('6.should count the correct number of buckets', async () => {
		const { data } = await api
			.post({
				endpoint: gqlPath,
				body: {
					query: print(gql`
					{
						${documentType} {
							aggregations(
								aggregations_filter_themselves: true
							) {
								clinical_diagnosis__clinical_stage_grouping {
									bucket_count
								}
							}
						}
					}
				`),
				},
			})
			.catch((err) => {
				console.log('readAggregation error', err);
			});

		expect({
			data: {
				[documentType]: {
					aggregations: {
						clinical_diagnosis__clinical_stage_grouping: {
							bucket_count:
								data.data[documentType].aggregations.clinical_diagnosis__clinical_stage_grouping
									.bucket_count,
						},
					},
				},
			},
		}).to.eql({
			data: {
				[documentType]: {
					aggregations: {
						clinical_diagnosis__clinical_stage_grouping: {
							bucket_count: 2,
						},
					},
				},
			},
		});
	});

	it('7.should ignore buckets with key "MISSING" when include_missing=false', async () => {
		const { data } = await api
			.post({
				endpoint: gqlPath,
				body: {
					query: print(gql`
					{
						${documentType} {
							aggregations(
								aggregations_filter_themselves: true
								include_missing: false
							) {
								clinical_diagnosis__histological_type {
									bucket_count
								}
							}
						}
					}
				`),
				},
			})
			.catch((err) => {
				console.log('readAggregation error', err);
			});

		expect({
			data: {
				[documentType]: {
					aggregations: {
						clinical_diagnosis__histological_type: {
							bucket_count:
								data.data[documentType].aggregations.clinical_diagnosis__histological_type
									.bucket_count,
						},
					},
				},
			},
		}).to.eql({
			data: {
				[documentType]: {
					aggregations: {
						clinical_diagnosis__histological_type: {
							bucket_count: 0,
						},
					},
				},
			},
		});
	});

	it('8.should count buckets with key "MISSING" when include_missing is defaulted to true', async () => {
		const { data } = await api
			.post({
				endpoint: gqlPath,
				body: {
					query: print(gql`
					{
						${documentType} {
							aggregations(
								aggregations_filter_themselves: true
							) {
								clinical_diagnosis__histological_type {
									bucket_count
								}
							}
						}
					}
				`),
				},
			})
			.catch((err) => {
				console.log('readAggregation error', err);
			});

		expect({
			data: {
				[documentType]: {
					aggregations: {
						clinical_diagnosis__histological_type: {
							bucket_count:
								data.data[documentType].aggregations.clinical_diagnosis__histological_type
									.bucket_count,
						},
					},
				},
			},
		}).to.eql({
			data: {
				[documentType]: {
					aggregations: {
						clinical_diagnosis__histological_type: {
							bucket_count: 1,
						},
					},
				},
			},
		});
	});

	it('9.should not include access_denied documents', async () => {
		const { data } = await api
			.post({
				endpoint: gqlPath,
				body: {
					query: print(gql`
					{
						${documentType} {
							aggregations(
								aggregations_filter_themselves: true
								include_missing: false
							) {
								access_denied {
									buckets {
										key_as_string
									}
								}
							}
						}
					}
				`),
				},
			})
			.catch((err) => {
				console.log('readAggregation error', err);
			});

		expect({
			data: {
				[documentType]: {
					aggregations: {
						access_denied: {
							buckets: data.data[documentType].aggregations.access_denied.buckets,
						},
					},
				},
			},
		}).to.eql({
			data: {
				[documentType]: {
					aggregations: {
						access_denied: {
							buckets: [{ key_as_string: 'false' }],
						},
					},
				},
			},
		});
	});
};
