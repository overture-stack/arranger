---
sidebar_position: 4
---

# Introspection API

Arranger exposes a set of read-only REST endpoints that describe the server's configuration and field structure at runtime. These endpoints are intended for tooling, LLM integration, and operator use — they do not require a GraphQL client and return plain JSON.

---

## `GET /introspection`

Returns a summary of all catalogues registered on this server instance, along with their document types, GraphQL and introspection paths, and the path to the shared SQON schema.

```json
{
	"catalogCount": 1,
	"mode": "single",
	"sqonSchemaPath": "/introspection/sqon",
	"catalogs": {
		"participants": {
			"description": "Clinical trial participant records.",
			"documentType": "participant",
			"paths": {
				"fields": "/introspection/fields",
				"graphql": "/graphql",
				"introspection": "/introspection/participants"
			}
		}
	}
}
```

- `mode` is `"single"` when one catalogue is registered, `"multi"` otherwise.
- `description` is omitted when not set in the catalogue's `base.json`.
- `paths.fields` is only present in single-catalogue mode as a convenience alias (see below).

---

## `GET /introspection/:catalogueId`

Returns field-level details for one catalogue: all fields, their Elasticsearch types, and which SQON operators apply to each type. Use this to discover what fields are queryable and how to construct valid SQON filters against them.

```json
{
	"catalogId": "participants",
	"description": "Clinical trial participant records.",
	"documentType": "participant",
	"generatedAt": "2026-05-27T00:00:00.000Z",
	"meta": { "authFiltered": false },
	"operators": {
		"keyword": ["in", "not-in", "some-not-in", "all", "filter"],
		"long": ["in", "not-in", "gt", "gte", "lt", "lte", "between"],
		"date": ["in", "not-in", "gt", "gte", "lt", "lte", "between"]
	},
	"fields": {
		"participant_id": {
			"displayName": "Participant ID",
			"type": "keyword"
		},
		"age_at_diagnosis": {
			"displayName": "Age at Diagnosis",
			"type": "long",
			"unit": "year"
		},
		"diagnosis_date": {
			"displayName": "Diagnosis Date",
			"type": "date"
		}
	}
}
```

- **`operators`** groups valid SQON operators by field type. To find which operators apply to a given field, look up `operators[field.type]`. Only types actually present in the catalogue's index appear here.
- **`fields`** lists every indexed field with its `displayName`, `type`, and optional `unit`. The `description` key is omitted when not configured in the extended mapping.
- **`meta.authFiltered`** indicates whether a server-side filter was active when the response was generated (i.e. the field list may be narrowed by access control).

Note: In single-catalogue mode, `/introspection/fields` is an alias for this endpoint, and this disappears when a second catalogue is added. Code that hardcodes `/introspection/fields` should be updated to use the explicit catalogue ID path before adding a second catalogue.

---

## `GET /introspection/sqon`

Returns the SQON JSON Schema and operator metadata shared across all catalogues — combination operators (`and`, `or`, `not`), field operators with value types and applicability, and accepted aliases.

Use this to validate or describe SQON structure independently of any specific catalogue's field set. For field-specific operator applicability, use `/introspection/:catalogueId` instead.

See [SQONs in detail](./03-sqon-in-detail.md) for full documentation of the SQON filter language.

---

## GraphQL introspection

The REST endpoints above are Arranger's own introspection API and are always available regardless of GraphQL settings. GraphQL's built-in introspection system (`__schema`, `__type` queries) is a separate capability that Arranger gates with the `disableGraphQLIntrospection` flag.

By default, GraphQL introspection is disabled when `NODE_ENV=production` and enabled otherwise. You can also control it explicitly:

- In a catalogue config file (`base.json`): `"disableGraphQLIntrospection": true`
- Via environment variable: `DISABLE_GRAPHQL_INTROSPECTION=true`

Disabling GraphQL introspection is recommended in production to avoid exposing schema structure to clients through `__schema`/`__type` queries (OWASP A02).

**Caveat - network aggregation:** When network search federation is active, Arranger queries each remote node's GraphQL endpoint using `__type` to discover its aggregation field types at startup. If a remote node has GraphQL introspection disabled, that node's schema discovery fails and it is silently excluded from federation. Until this dependency is replaced with a REST-based discovery call, do not set `disableGraphQLIntrospection: true` on any node that serves as a remote target in a network aggregation deployment.
