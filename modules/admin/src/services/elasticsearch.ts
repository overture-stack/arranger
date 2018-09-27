import { Client } from 'elasticsearch';

export const createClient = (esHost: string) =>
  new Client({
    host: esHost,
    log: 'trace',
  });
