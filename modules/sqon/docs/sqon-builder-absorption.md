# `sqon-builder` absorption into `@overture-stack/sqon`

## What was absorbed

`@overture-stack/sqon-builder` was a standalone package that provided a chainable builder API for
constructing SQON queries programmatically. It was used in `modules/components`, in
`graphql-router`'s `convertToSqon` path, and by external consumers.

The builder API (and its utilities) now lives in this package under `src/builder/`, and
`@overture-stack/sqon` is the single package for everything SQON: schema definitions, operator
metadata, JSON Schema, validation, and programmatic construction.

## Why

**Eliminate dual-package confusion.** Arranger already defined SQON schema and operator metadata
here. A separate builder package meant two packages describing the same domain, with diverging type
definitions and no enforced consistency between them.

**Fix the `& SQON` type anti-pattern.** `sqon-builder` typed its builder as `SQONBuilder & SQON`,
meaning the builder object was simultaneously the SQON data. This was incorrect: `SqonNode` (the
data type) is a plain JSON-serializable value. The builder is a construction utility. Conflating
them forced workarounds like `cloneDeepValues` and `StripFunctions<T>` to strip builder methods
before serialization, and caused a `@ts-expect-error` in downstream consumers where type boundaries
were unclear.

**Full operator coverage.** `sqon-builder` implemented `in`, `gt`, and `lt` only. It could not
build `not-in`, `some-not-in`, `all`, `gte`, `lte`, `between`, or `wildcard` queries - a gap that
had to be filled with ad-hoc object construction at call sites. The absorbed builder covers all
operators defined by the SQON schema.

**Single source of truth.** Any operator the schema can validate, the builder can construct. The
two are grounded in the same Zod schema and operator metadata, which eliminates the category of bug
where validation and construction diverge.

## Design decisions

### `SqonNode` at the boundary, `SqonBuilderHandle` as the local tool

`SqonNode` is the data type. It is a plain JSON-serializable object, passed at function boundaries,
stored, logged, sent over the wire, and parsed back with `SqonBuilder.from()`.

`SqonBuilderHandle` is the chainable wrapper. It holds a `SqonNode` internally and exposes
builder methods. It is a local construction utility, not a data type - it must never appear in
function signatures that cross module or service boundaries.

This is the direct correction of the `& SQON` anti-pattern. The separation means:
- Consumers are not forced to depend on the builder.
- `SqonNode` can be serialized without stripping methods.
- `cloneDeepValues` has no purpose and was not ported.

Extraction is explicit: call `.toValue()` to get the underlying `SqonNode`.

### `reduce` ported and grounded in Zod types

`reduceSQON` from `sqon-builder` was ported as `reduceSqon` in `src/builder/reduce.ts`. The
algorithm merges duplicate filters under the same combination (e.g. two `gt` on `and` collapses to
the larger value), unwraps single-item wrappers, and removes empty combinations.

The ported version operates on `SqonNode` types from this package's Zod schema, not `sqon-builder`'s
internal types.

### What was not ported

- `cloneDeepValues`: a workaround for the `& SQON` anti-pattern; has no purpose in the new design.
- `StripFunctions<T>`: same reason.
- `sqon-builder`'s constant names (`FilterKeys`, `ArrayFilterKeys`, etc.): superseded by
  `sqonFieldOperatorProperties`, `sqonCombinationProperties`, and `sqonAliasProperties`.
- The `& SQON` type intersection pattern: replaced by explicit `.toValue()` extraction.

## Migration for consumers of `sqon-builder`

Replace `@overture-stack/sqon-builder` with `@overture-stack/sqon`:

```ts
// Before
import SQONBuilder from '@overture-stack/sqon-builder';
const sqon = SQONBuilder.in('status', ['active']).gt('age', 18);

// After
import { SqonBuilder } from '@overture-stack/sqon';
const sqon = SqonBuilder.in('status', ['active']).gt('age', 18).toValue();
```

Key differences:
- Import is a named export, not a default export.
- Chain results must be extracted with `.toValue()` before passing outside the builder.
- `SqonBuilder.from(raw)` parses and validates an unknown input (was `SQON.parse(raw)` in some
  versions).
- All operators are available: `notIn`, `someNotIn`, `all`, `gte`, `lte`, `between`, `wildcard`.
