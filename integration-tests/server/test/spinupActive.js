import { expect } from 'chai';

export default ({ server, projectId, port, api }) =>
	it(`1.should register active projects' ping/graphql endpoints`, (done) => {
		server.listen(port, async () => {
			let response = await api
				.get({
					endpoint: `${projectId}/ping`,
					then: (r) => r.text(),
				})
				.catch((err) => {
					console.log('spinupActive error', err);
				});

			expect(response).to.equal('ok');

			server.close();

			done();
		});
	});
