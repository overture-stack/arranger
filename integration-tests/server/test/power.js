import { expect } from 'chai';

export default ({ server }) =>
  it('should start and stop on demand', done => {
    expect(server.status).to.equal('off');
    server.listen(7357, () => {
      expect(server.status).to.equal('on');
      server.close(() => {
        expect(server.status).to.equal('off');
        done();
      });
    });
  });
