import { expect } from 'chai';
import { print } from 'graphql';
import gql from 'graphql-tag';

export default ({ api, documentType, gqlPath }) => {
	it('1.reads extended mapping properly', async () => {
		const { data } = await api
			.post({
				endpoint: gqlPath,
				body: {
					query: print(gql`
					{
						${documentType} {
							configs {
								extended
							}
						}
					}
				`),
				},
			})
			.catch((err) => {
				console.log('readMetadata error', err);
			});

		expect(data?.data?.[documentType]?.configs?.extended).to.be.not.empty;
		expect(data?.errors).to.be.undefined;
	});

	it('2.reads elasticsearch mappings properly', async () => {
		const { data } = await api
			.post({
				endpoint: gqlPath,
				body: {
					query: print(gql`
					{
						${documentType} {
							mapping
						}
					}
				`),
				},
			})
			.catch((err) => {
				console.log('readMetadata error', err);
			});

		expect(data?.data?.[documentType]?.mapping).to.be.not.empty;
		expect(data?.errors).to.be.undefined;
	});

	it('3.reads aggregations properly', async () => {
		const { data } = await api
			.post({
				endpoint: gqlPath,
				body: {
					query: print(gql`
					{
						${documentType} {
							configs {
								facets {
									aggregations {
										fieldName
										active
										show
									}
								}
							}
						}
					}
				`),
				},
			})
			.catch((err) => {
				console.log('readMetadata error', err);
			});

		expect(data?.data?.[documentType]?.configs?.facets?.aggregations).to.be.not.empty;
		expect(data?.errors).to.be.undefined;
	});

	it('4.reads table configs properly', async () => {
		const { data } = await api
			.post({
				endpoint: gqlPath,
				body: {
					query: print(gql`
					{
						${documentType} {
							configs {
								table {
									keyFieldName
								}
							}
						}
					}
				`),
				},
			})
			.catch((err) => {
				console.log('readMetadata error', err);
			});

		expect(data?.data?.[documentType]?.configs?.table).to.be.not.empty;
		expect(data?.errors).to.be.undefined;
	});

	it('5.reads matchbox state properly', async () => {
		const { data } = await api
			.post({
				endpoint: gqlPath,
				body: {
					query: print(gql`
					{
						${documentType} {
							configs {
								matchbox {
									fieldName
								}
							}
						}
					}
				`),
				},
			})
			.catch((err) => {
				console.log('readMetadata error', err);
			});

		expect(data?.data?.[documentType]?.configs?.matchbox).to.be.not.empty;
		expect(data?.errors).to.be.undefined;
	});
};
