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
- a group node, whose `content` holds other nodes, or none at all, in which case it is match-all (see [An empty group is match-all](#an-empty-group-is-match-all))

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

### What each group operator means

Whether a document matches a group depends on how many of the nodes in the group's `content` it matches:

- `and`: all of them
- `or`: at least one
- `not`: none of them, so a document that matches any one of them is excluded (with a `pivot`, only when one nested object meets all of them; see [Pivot](#pivot))

### An empty group is match-all

This page uses two terms for the two extremes a filter can reach:

- **match-all**: places no condition, so every document the query searches satisfies it
- **match-none**: no document satisfies it

Where a deployment applies access control, the server combines its own filter with every query, so a match-all query still returns only the documents the person may see.

A group whose `content` is `[]`, whether `and`, `or` or `not`, is match-all wherever it appears, and a valid `pivot` on it has no effect. A pivot that names no nested field is refused wherever it sits, on an empty group as on any other node. A root empty `and` is the one canonical way for a query to say "no filter", and every Arranger read path accepts it, network search included. An access filter never takes this form: one that allows everything is a `not` around a `matchNothing` leaf, which is what the GraphQL router's `includeEverything` returns (see [Filters that restrict access](#filters-that-restrict-access)).


```json
{ "op": "and", "content": [] }
```

Inside a larger query, what a match-all node does depends on the group that contains it. Written compactly, with `X` standing for any other filter:

| SQON | Result |
| --- | --- |
| `and[X, or[]]` | whatever `X` matches: inside an `and`, a match-all node adds no condition |
| `or[X, or[]]` | match-all: inside an `or`, one match-all node satisfies the whole group |
| `not[X, or[]]` | match-none: `not` keeps only documents that match none of its nodes, and every document matches the match-all one |

**Don't rely on a nested empty group reaching every backend.** A backend may refuse a query containing an empty group rather than read it, and refuses the whole query when it does. It may accept a root empty `and` while refusing nested ones. So generated SQON should never contain a nested empty group: write match-none with `matchNothing`, match-all as a `not` around a `matchNothing` leaf, and a set of values as one leaf's value list (see [Filters that restrict access](#filters-that-restrict-access)).

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

`fieldName` is the dotted path of the field the clause tests, such as `donor.age`. The key must be `fieldName`: a clause that uses the key `field` instead names no field.

The `wildcard` operator is the exception and instead uses `fieldNames` (plural): a document matches if any one of those fields matches the pattern.

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

`in`, `not-in` and `some-not-in` take a value, or a list of values, that the field is tested against. `all` takes the values the field must all hold, at least one. For what each does with an empty list, see [An empty value list is not an empty group](#an-empty-value-list-is-not-an-empty-group).

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

`gt`, `gte`, `lt` and `lte` take one bound: a number, or a date string for a date field. Given a list, every bound applies, so the strictest one decides: the largest for `gt` and `gte`, the smallest for `lt` and `lte`. `between` takes `[min, max]`, both inclusive.

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

| Alias    | Canonical Operator |
| -------- | ------------------ |
| `=`      | `in`               |
| `==`     | `in`               |
| `===`    | `in`               |
| `!=`     | `not-in`           |
| `!==`    | `not-in`           |
| `>`      | `gt`               |
| `>=`     | `gte`              |
| `<`      | `lt`               |
| `<=`     | `lte`              |
| `filter` | `wildcard`         |

For interoperability, the canonical operator names are always preferred when generating new SQONs.

## Pivot

A SQON node may also include `pivot`: the path of a nested field that scopes the node. Conditions under it on fields within that path are tested against one nested object at a time:

- an `and` matches a document when one of its nested objects meets every condition;
- an `or` matches when one of its nested objects meets any of them;
- a `not` matches when none of its nested objects meets all of them, so it excludes a document only when a single nested object meets every condition. Without a pivot, a `not` excludes a document that matches any one of its conditions. A condition under a pivoted `not` on a field outside its path is negated on its own, as it would be without a pivot.

Without a pivot, conditions on a nested field may each be met by a different nested object. A pivot must name a nested field of the catalogue being queried.

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
- on an empty group, a valid `pivot` has no effect: the group stays match-all

A pivot can still be rejected later at runtime if it does not match a valid nested field path for the active catalogue.

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

### `in` and "`not` of `not-in`" aren't the same, for a nested field

**TLDR:** on a field inside a nested list (like `items` in the basket example above), `in` means "at least one item matches"; "`not` of `not-in`" means "every item matches" (including a basket with no items at all). They aren't interchangeable, even though negating `not-in` looks like it should just hand you back `in`.

```json
{ "op": "in", "content": { "fieldName": "items.color", "value": ["red"] } }
```

```json
{
	"op": "not",
	"content": [{ "op": "not-in", "content": { "fieldName": "items.color", "value": ["red"] } }]
}
```

Both read, in plain English, as "an item is red." Only the first one reliably means that.

<details>
<summary><b>Why: a nested filter only ever asks "does at least one item match"</b></summary>

`in` on a nested field asks Elasticsearch "does at least one item match red?" `not-in` asks the mirror question, "does at least one item match something other than red?" Both are answered the same way: find one matching item, anywhere in the list.

The problem is negating that question from the outside. "Not (at least one item is some other colour)" doesn't mean "at least one item is red," it means "every item is red" (there's no item left that could be some other colour), including the case where there are no items at all, which trivially satisfies "every item is X" for any X. That's a general fact about "at least one of these matches" questions, not specific to Arranger or to any particular field or value:

- **A basket with no `items` at all:** `in: 'red'` doesn't match: there's no item to be red. The double-negated form does match, vacuously ("every item is red" is trivially true when there are no items).
- **A basket with a mix of colours, only some red:** `in: 'red'` matches: at least one item qualifies. The double-negated form doesn't: it needs every item to be red, not just one.

They only agree when a basket's items are uniformly all-red or all-not-red, and even then the no-items case still diverges.

Pivot doesn't change any of this: pivot scopes *multiple* conditions to the same nested item (see [Pivot](#pivot) above); it has no effect on negating a *single* condition, which is what's happening here.

This applies to any value on a nested field, not just an ordinary one like `'red'`. It's also why negating a `__missing__` check the same way is surprising: `__missing__` is just a value from the query builder's perspective, so it inherits the exact same gotcha. If you specifically want "at least one item is missing this field," the same rule applies: use `in` with `__missing__` directly rather than negating `not-in`.

</details>

### An empty value list is not an empty group

A leaf whose `value` is `[]` keeps its own operator's meaning, unlike an empty group, which is always match-all:

| Leaf | Matches |
| --- | --- |
| `in` with `[]` | match-none. This is how a filter writes "deny", through `SqonBuilder.matchNothing(fieldName).toValue()`, so no backend may refuse it. |
| `not-in` with `[]` | match-all on a flat field. On a nested field, only the documents with at least one nested item, since `not-in` on a nested field asks whether some item holds a value outside the list (see the section above). |
| `some-not-in` with `[]` | match-all |
| `all` with `[]` | invalid: the schema rejects it |

```json
{ "op": "in", "content": { "fieldName": "fruit.color", "value": [] } }
```

### Filters that restrict access

Code that builds a filter to limit what a person can see, such as an access-control filter, follows these rules, most of them because an empty group is match-all:

- **It never contains an empty group, at any depth, the root included.** A filter assembled from a list that turned out to be empty would widen access instead of narrowing it. So code with no grants to express handles that case first, as a deny, and never builds a group from the empty list.
- **It treats a list it could not load as a deny, never as an empty list.** An empty exclusion list excludes nothing, so a failed lookup read as an empty list would admit everything.
- **It writes a set of values as one leaf's value list**, never as a group of single-value leaves. An empty value list keeps its meaning, so an empty `in` is match-none, where an empty group of leaves is match-all.
- **It lists its values rather than referencing a saved set**, so what it matches never depends on a document stored somewhere else.
- **It denies by returning `SqonBuilder.matchNothing(fieldName).toValue()`, and allows by returning the GraphQL router's `includeEverything(context)`**, a `not` around such a leaf. `matchNothing` returns a builder, and a callback has to return the filter it holds. Both carry a leaf, so neither is an empty group.
- **The code composing it checks it.** Besides empty groups, it refuses the parts that would match broadly where nobody meant them to: an `all` with no values, a range with no bound, a clause naming no field, an exclusion missing its value list, and an entry that is not a SQON node. No part of a SQON marks it as an access filter, so neither reduction nor a backend can apply these rules on its behalf.

Arranger refuses a deployment's server-side filter that holds an empty group or any of the broad parts listed in the last rule, before combining it with a query. The other rules are for the code that builds the filter, since only that code knows where its values came from.

## Introspection

The `GET /introspection/sqon` endpoint returns the SQON JSON Schema and operator metadata for this server: combination operators, field operators with value types and applicability, and accepted aliases. Use it to validate or describe SQON structure independently of any specific catalogue.

For full introspection API documentation: including catalogue discovery and per-catalogue field listings: see [Introspection API](./05-introspection.md).
