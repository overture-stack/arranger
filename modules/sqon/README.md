# @overture-stack/sqon

Shared SQON definitions and query builder for Overture services.

## Purpose

- Define SQON syntax in a centralized place, using Zod schemas.
- Export TypeScript types from the same shared source code.
- Export a JSON Schema derived from the Zod schema.
- Provide a programmatic builder API for constructing SQON queries.

## Usage

### The recommended pattern: accept `SqonNode`, compose locally

Functions should accept and return `SqonNode` (the plain data type) at their boundaries. Use
`SqonBuilder` inside the function when you need to compose or modify the SQON, then extract the
result with `.toValue()`.

```ts
import { SqonBuilder, type SqonNode } from '@overture-stack/sqon';

function addStatusFilter(sqon: SqonNode, statuses: string[]): SqonNode {
	return SqonBuilder.from(sqon).in('status', statuses).toValue();
}

function buildDefaultQuery(): SqonNode {
	return SqonBuilder.empty().in('status', ['active']).gt('age', 18).toValue();
}
```

**Why `SqonNode` at the boundary, not `SqonBuilderHandle`?** `SqonNode` is a plain JSON-serializable
object - it can be stored, logged, sent over the wire, and parsed back with `SqonBuilder.from()`.
A `SqonBuilderHandle` is a local utility object. Keeping `SqonNode` as the shared currency means
callers are not forced to depend on the builder.

### Parsing and validating an incoming SQON

`SqonBuilder.from()` parses and validates an unknown value (object or JSON string). It throws a
`ZodError` if the input is not a valid SQON, making it suitable for use at service boundaries
where input must be validated.

```ts
import { SqonBuilder, type SqonNode } from '@overture-stack/sqon';

function parseFilter(raw: unknown): SqonNode {
	return SqonBuilder.from(raw).toValue();
}
```

### Building filters

```ts
SqonBuilder.in('status', ['active', 'pending']);
SqonBuilder.notIn('type', ['internal']);
SqonBuilder.gt('age', 18);
SqonBuilder.between('score', [50, 100]);
SqonBuilder.wildcard(['donor.name', 'donor.alias'], 'jo*');
```

### Combining filters

```ts
SqonBuilder.and([SqonBuilder.in('status', ['active']).toValue(), SqonBuilder.gt('age', 18).toValue()]).toValue();

// or chain them:
SqonBuilder.in('status', ['active'])
	.and(SqonBuilder.gt('age', 18).toValue())
	.not(SqonBuilder.in('type', ['internal']).toValue())
	.toValue();
```

### Type reference

| Type                | What it is                                                                          |
| ------------------- | ----------------------------------------------------------------------------------- |
| `SqonNode`          | Plain JSON-serializable SQON data. Use in function signatures.                      |
| `SqonBuilder`       | The factory object type. Use only when holding or passing the factory itself.       |
| `SqonBuilderHandle` | The chainable handle returned by factory methods. Rarely needs explicit annotation. |
| `SqonFieldFilter`   | A field-based leaf node (has `content.fieldName`). Used with `removeExactFilter`.   |

## Notes

- This package is intentionally both transport- and endpoint-agnostic.
- Runtime-specific behavior (for example, warnings, normalization side-effects, ACL) belongs in consuming services.
- The `wildcard` builder method emits `op: 'wildcard'`. The schema also accepts `op: 'filter'` as a legacy alias, so existing serialized SQONs continue to parse and validate correctly.
