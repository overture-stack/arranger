# SQONs In Detail

SQON is a JSON-based filter language Overture uses to describe query logic in a backend-neutral way, while retaining human readability and portability. This page focuses on the shape of a SQON itself: what nodes exist, what operators are supported, what aliases are accepted, and which edge cases matter when generating SQON programmatically.

<details>
<summary><b>Example: Flat Filter vs. SQON</b></summary>

**Flat Filter Approach:**

A typical flat filter uses simple key-value pairs with implicit AND logic:

```json
{
	"province": "Ontario",
	"age": "20-29"
}
```

**General limitations of a flat filter:**

- Can only express AND logic (all conditions must match)
- Cannot express OR relationships between filters
- Cannot nest conditions or create complex boolean expressions

**SQON Approach:**

SQON can express the same filter explicitly:

```json showLineNumbers
{
	"op": "and",
	"content": [
		{
			"op": "in",
			"content": {
				"fieldName": "province",
				"value": ["Ontario"]
			}
		},
		{
			"op": "in",
			"content": {
				"fieldName": "age",
				"value": ["20-29"]
			}
		}
	]
}
```

</details>

## Mental Model

Visualize a SQON as a "tree" of nested operations, that may contain one of two kinds of elements:

- **Leaf nodes** apply an operator to one or more field values. e.g. age is between 0 and 100.
- **Group nodes** combine other SQON nodes with boolean logic. e.g. the AND in "and eye color is brown".

A SQON may start at either level:

- a single leaf node
- a group node containing one or more child nodes

## Group Nodes

<details>
<summary><b>Group nodes combine child SQON nodes.</b> e.g. "filter X" AND "filter Y"</summary>

```json showLineNumbers
{
	"op": "and",
	"content": [
		{
			"op": "in",
			"content": {
				"fieldName": "fruit.color",
				"value": ["red"]
			}
		},
		{
			"op": "gte",
			"content": {
				"fieldName": "fruit.weight_grams",
				"value": 100
			}
		}
	]
}
```

This results in:

- fruit color is red
- and fruit weight is at least 100 grams

### Supported group operators

- `and`
- `or`
- `not`

### Group shape

```json
{
	"op": "and | or | not",
	"content": ["SQON", "SQON", "..."]
}
```

</details>

## Leaf Nodes

<details>
<summary><b>Leaf nodes describe a field-level filter.</b> e.g. "value X" IN "field Y" </summary>

```json
{
	"op": "in",
	"content": {
		"fieldName": "fruit.color",
		"value": ["red"]
	}
}
```

This results in:

- fruit color is red

Most leaf nodes use:

- `fieldName`
- `value`

The `wildcard` operator is the exception and instead uses `fieldNames` (plural).

</details>

## Field Operators

SQONs can apply several kinds of filtering to fields and values:

- **membership** answers questions like "is this value in the allowed set?" or "is it excluded from that set?"
- **range** compares values against bounds such as greater than, less than, or between two endpoints
- **wildcard** performs a case-insensitive substring match across one or more fields using ES/OS wildcard queries

### Membership-style operators

- `in`
- `not-in`
- `some-not-in`
- `all`

<details>
<summary><b>Example:</b></summary>

```json
{
	"op": "in",
	"content": {
		"fieldName": "fruit.color",
		"value": ["red", "green"]
	}
}
```

This results in:

- fruit color is red or green

</details>

### Range-style operators

- `gt`
- `gte`
- `lt`
- `lte`
- `between`

<details>
<summary><b>Example:</b></summary>

```json
{
	"op": "between",
	"content": {
		"fieldName": "fruit.weight_grams",
		"value": [100, 200]
	}
}
```

This results in:

- fruit weight is between 100 and 200 grams

</details>

### Wildcard operator

- `wildcard`

<details>
<summary><b>Example:</b></summary>

```json
{
	"op": "wildcard",
	"content": {
		"fieldNames": ["fruit.name", "fruit.nickname"],
		"value": "*app*"
	}
}
```

This results in:

- case-insensitive substring match for `app` in either `fruit.name` or `fruit.nickname`

The wildcard operator translates to an ES/OS `wildcard` query with `case_insensitive: true`. Use `*` in the value to express substring patterns (e.g. `*apple*`, `apple*`, `*apple`). This is distinct from fuzzy (edit-distance) matching: it finds substrings, not approximate terms.

</details>

## Accepted Operator Aliases

Arranger accepts several shorthand aliases in addition to canonical operators.

| Alias | Canonical Operator |
| ----- | ------------------ |
| `=`   | `in`               |
| `==`  | `in`               |
| `===` | `in`               |
| `!=`  | `not-in`           |
| `!==` | `not-in`           |
| `>`   | `gt`               |
| `>=`  | `gte`              |
| `<`   | `lt`               |
| `<=`  | `lte`              |
| `filter` | `wildcard`      |

For interoperability, the canonical operator names are always preferred when generating new SQONs.

## Pivot

A SQON node may also include `pivot`.

Consider a set of records shaped like this:

```json
[
	{
		"basket_name": "Andy's basket",
		"items": [
			{ "name": "apple", "color": "red" },
			{ "name": "pear", "color": "yellow" }
		]
	},
	{
		"basket_name": "Max's basket",
		"items": [
			{ "name": "apple", "color": "green" },
			{ "name": "cherry", "color": "red" }
		]
	}
]
```

Now imagine we want to express:

- there exists an item whose name is apple
- and that same item is red

<details>
<summary><b>Without a pivot</b></summary>

```json
{
	"op": "and",
	"content": [
		{
			"op": "in",
			"content": {
				"fieldName": "items.name",
				"value": ["apple"]
			}
		},
		{
			"op": "in",
			"content": {
				"fieldName": "items.color",
				"value": ["red"]
			}
		}
	]
}
```

This can be read as:

- some item has the name apple
- and some item has the color red

</details>

That may accidentally match across different nested objects, providing green apples and red cherries.

<details>
<summary><b>With a pivot</b></summary>

```json
{
	"op": "and",
	"pivot": "items",
	"content": [
		{
			"op": "in",
			"content": {
				"fieldName": "items.name",
				"value": ["apple"]
			}
		},
		{
			"op": "in",
			"content": {
				"fieldName": "items.color",
				"value": ["red"]
			}
		}
	]
}
```

</details>

The `pivot` is used to anchor a filter to a nested path. This matters when Arranger translates SQON into Elasticsearch nested queries.

This results in:

- look within the `items` nested path, and
- require the `apple` and `red` conditions to be true for the same nested item

So the practical difference is:

- **without pivot**: the conditions may be satisfied by different nested rows
- **with pivot**: the conditions are scoped to the same nested row

In practice:

- most simple SQONs omit `pivot`
- nested aggregations and nested field filtering are where `pivot` becomes important
- `pivot` may appear on either leaf or group nodes

A pivot can still be rejected later at runtime if it does not match a valid nested field path for the active catalog.

## Current Accepted Value Shapes

The current Arranger SQON schema accepts:

- membership operators: scalar or array
- range operators: scalar or array
- `between`: scalar or array with at least 2 items
- `filter`: string

That reflects current compatibility behavior, not necessarily the final ideal shape. In particular:

- range operators currently tolerate arrays even though scalar values are usually clearer
- `between` currently accepts arrays longer than 2, and downstream logic may reduce them to a min/max pair

Programmatic clients should prefer the clearer forms:

- `gt`, `gte`, `lt`, `lte`: single scalar value
- `between`: exactly 2 values

## Extra Keys

<details>
<summary><b>Arranger currently accepts but ignores extra keys on SQON nodes and content objects.</b></summary>

That means this is structurally valid today:

```json
{
	"op": "in",
	"content": {
		"fieldName": "fruit.color",
		"value": ["red"],
		"extraContent": true
	},
	"extraTopLevel": "ignored"
}
```

This results in:

- fruit color is red
- and the extra keys are ignored by current SQON validation

</details>

## Important Edge Cases

These are worth handling explicitly when generating SQON in other systems such as MCP servers.

### Falsy values can still be valid

These are valid SQON values and should not be treated as missing:

- `0`
- `""`

<details>
<summary><b>Examples:</b></summary>

```json
{
	"op": "gte",
	"content": {
		"fieldName": "fruit.weight_grams",
		"value": 0
	}
}
```

This results in:

- fruit weight is at least 0 grams

```json
{
	"op": "in",
	"content": {
		"fieldName": "fruit.label",
		"value": ""
	}
}
```

This results in:

- fruit label is the empty string

</details>

### Special Arranger values

Some values have special downstream meaning in Arranger.

Examples include:

- `set_id:<id>`
- `__missing__`
- wildcard-like strings such as `ABC*`

These are still ordinary SQON values structurally, but Arranger may compile them into specialized Elasticsearch queries.

## Recommended Generation Rules

If you are generating SQON automatically, the safest defaults are:

1. Prefer canonical operator names over aliases.
2. Use leaf-root SQON only for a single simple condition.
3. Use group-root SQON for composed logic.
4. Use scalar values for `gt`, `gte`, `lt`, and `lte`.
5. Use exactly 2 values for `between`.
6. Preserve valid falsy values such as `0` and `""`.
7. Do not invent `pivot` unless you know the nested path semantics.
8. Treat catalog field names and allowed values as catalog-specific introspection data, not SQON syntax.

## Introspection

The `GET /introspection/sqon` endpoint returns the SQON JSON Schema and operator metadata for this server — combination operators, field operators with value types and applicability, and accepted aliases. Use it to validate or describe SQON structure independently of any specific catalogue.

For full introspection API documentation — including catalogue discovery and per-catalogue field listings — see [Introspection API](./04-introspection.md).
