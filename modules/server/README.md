# Arranger Server

```
npm i -g @overture-stack/arranger-server
arranger-server
```

#### Develop

Run:

```
PORT=<...> ES_HOST=<...> npm start
```

Build (required before publish):

```
npm run prepare
```

## Federated Search

### Config

Pass `true` to the environment variable `ENABLE_NETWORK_AGGREGATION` to enabled federated search.
