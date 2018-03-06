import createServer from '@arranger/server';

export default () =>
  test('server should start and stop on demand', () => {
    let server = createServer();
    expect(server.status).toBe('off');
    server.listen(7357, () => {
      expect(server.status).toBe('on');
      server.close(() => {
        expect(server.status).toBe('off');
      });
    });
  });
