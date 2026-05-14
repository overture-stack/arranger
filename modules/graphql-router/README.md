# Arranger Server
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

## Central server setup

### Configue Node servers via standard Arranger config file
```json
{
	"network": [
		{
			"displayName": "Toronto",
			"graphqlUrl": "http://localhost:6060/graphql",
			"documentType": "TorontoAggs",
			"documentName": "file"
		},
		{
			"displayName": "Barca",
			"graphqlUrl": "http://localhost:6061/graphql",
			"documentType": "BarcaAggs",
			"documentName": "donorAggs"
		}
	]
}
```

### Enable ENABLE_NETWORK_AGGREGATION in central node
Set ENABLE_NETWORK_AGGREGATION to TRUE in env config

### Assumptions
All nodes, including central, are running same Arranger version and have overlapping schemas.
Schema fields with same name and GQL type will be merged.


### Config

[Placeholder]
