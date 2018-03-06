import createServer from '@arranger/server';

test('server should start and stop no demand', () => {
  let server = createServer();
  expect(server.status).toBe('off');
  server.listen(7357, () => {
    expect(server.status).toBe('on');
  });
});
