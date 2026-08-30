# A first-class value-widening primitive for `SqonBuilder`: design proposal

**Status: draft, not yet implemented.** Written for adversarial review before any code, following
the same process `matchNothing()` went through. One round of adversarial review complete; corrected
below to reflect it. `not`'s compilation semantics in this doc were wrong in the first draft and are
fixed throughout; see "A related defect, and one non-defect" for the corrected version and how it
was checked. Developer has since decided: fix `setFilter`'s `not`-scope defect before `addToFilter`
proceeds; that fix is designed (Open Question 4, resolved: refuse rather than silently rewrite) and
now implemented, tested, and in the CHANGELOG. `addToFilter` itself is still unimplemented, pending
the rest of this review.

**Scope:** `modules/sqon`'s builder API only. Whether/how `modules/components` should adopt this is
a separate, already-open item (see "Out of scope" below).

---

## The problem

A faceted UI ticking a second value in the same facet needs one thing: "either of these values,"
expressed as a single `in` clause with both values. Two ways of building that currently exist, and
neither is the ergonomic one a consumer reaches for first.

**Chaining `.in()` for the same field does not do this: it `and`s.** `inFilter` is implemented as
`and(makeFieldLeaf('in', fieldName, value))`, unconditionally. Confirmed directly in this repo's own
test suite (`builder/index.test.ts`, "does not merge duplicate in filters on the same field under
and"):

```ts
SqonBuilder.in('status', ['active']).in('status', ['pending']).toValue();
// { op: 'and', content: [ in:status['active'], in:status['pending'] ] }
// = status is 'active' AND status is 'pending', impossible on a single-valued field
```

Before this session's `reduceSqon` fix, this same call produced `in:status['active','pending']`,
because the old (incorrect) merge rule unioned same-field `in` clauses under `and` regardless of
combination semantics. That was the bug: two `in` clauses under `and` mean their **intersection**,
not their union, so the old behaviour was silently repairing a construction error, not implementing
a feature. Fixing it was correct. It also means any consumer who relied on the old behaviour, by
calling `.in()` twice for the same field, or building the equivalent by hand, saw their results
change with no code change on their side. A downstream consumer (HCMI's portal, migrating onto the
published package) hit exactly this: a facet's search silently returned zero results after installing
a patch version, because their build was the "call `.in()` twice" shape. Relayed via a peer session
tracking that migration; the semver mechanics of why it arrived unannounced are independently
verified (see CHANGELOG/migration guide, already written).

**`setFilter` doesn't solve this ergonomically.** `setFilter(fieldName, 'in', values)` replaces the
existing unpivoted filter on `fieldName` with exactly `values`: correct, but it requires the caller
to already hold the complete value list. That's true for a consumer whose own state is the source of
truth (e.g. a facet component tracking `selectedValues: string[]` and calling `setFilter` with the
full array on every change); for that pattern, nothing here is needed, `setFilter` already does the
right thing. The gap is for a consumer treating the current `SqonNode` itself as the source of truth
and wanting to add one value to whatever's already there, without first extracting and reconstructing
the existing list by hand.

**A related defect, and one non-defect, found while checking `not` handling.** `setFilter` and
`removeFilter` both scan "the top level of the current SQON" without treating a top-level `not`
specially. Checked against a compiled query rather than assumed, since this exact question (what a
multi-child `not` actually means) is where this session's earlier `reduceSqon` work went wrong once
already before being corrected: `not[A, B]` compiles to a single `bool.must_not: [A, B]`
(`modules/graphql-router`'s `wrapMustNot`), which excludes a document matching *either* child, so the
surviving set is **`¬A ∧ ¬B`**, each child negated independently, not `¬(A ∧ B)`.

`setFilter` is affected, and the defect is a **sign inversion**, not an arbitrary change:

```ts
const base = { op: 'not', content: [
  { op: 'in', content: { fieldName: 'a', value: ['x'] } },
  { op: 'in', content: { fieldName: 'b', value: ['y'] } },
] }; // a≠x ∧ b≠y

SqonBuilder.from(base).setFilter('a', 'in', ['z']).toValue();
// { op: 'not', content: [ in:a['z'], in:b['y'] ] } // a≠z ∧ b≠y
```

The caller asked to assert `a is in [z]`, a positive condition, and silently got `a is not in [z]`,
the opposite of the request: the substitution lands inside the negation without compensating for it.
Confirmed this isn't limited to the replace path: when no existing filter matches (`setFilter('b',
'in', ['q'])` against `not[in:a['x']]`, no `b` clause present), the new leaf is appended straight into
`not`'s content array, `not[in:a['x'], in:b['q']]` = `a≠x ∧ b≠q`, the same sign inversion for a field
that had no prior filter at all.

**`removeFilter` is not defective.** Dropping a child from `not`'s content list drops one of the
independently-negated constraints, which correctly widens the match, exactly what "remove a filter"
should do:

```ts
SqonBuilder.from(base).removeFilter('a').toValue();
// { op: 'not', content: [ in:b['y'] ] } // b≠y: the a constraint is gone, as asked
```

Since the proposed method below delegates to `setFilter`, it inherits only `setFilter`'s defect, not
a `removeFilter`-shaped one.

## Proposed solution

Add an instance method (name TBD, `addToFilter` used below as a placeholder; see Open Question 1) that
adds value(s) to an existing same-field, same-op, unpivoted filter, creating one if none exists:

```ts
addToFilter: <K extends 'all' | 'in' | 'not-in' | 'some-not-in'>(
  fieldName: string,
  op: K,
  value: SqonFieldFilterTypeMap[K],
) => SqonBuilderHandle;
```

Implementation sketch (delegates to `setFilter`, so pivot handling is inherited for free, and so is
`setFilter`'s `not`-guard once that fix lands, see Open Questions 3 and 4):

```ts
const addToFilter = (fieldName, op, value) => {
  const existing = /* top-level unpivoted filter matching fieldName + op, same scan setFilter uses */;
  const merged = existing
    ? [...new Set([...asArray(existing.content.value), ...asArray(value)])]
    : asArray(value);
  return setFilter(fieldName, op, merged);
};
```

Dedupes via `new Set` (SameValueZero: `1` and `'1'` stay distinct), matching `reduceSqon`'s own
`deduplicateValues`, deliberately not the comparator-based path `checkMatchingArrays` uses (already
tracked in `.dev/tech-debt.md` as not a valid total order for mixed-type arrays; this sketch doesn't
touch that function and isn't affected by its defect). Does not sort, matching `.or()`'s existing
merge behaviour (see the 3.1 migration guide's ordering caveat), so a consumer already accounting for
that doesn't need to account for a second, differently-behaved merge path.

### Open questions, for the adversarial pass

1. **Name.** `addToFilter` reads as one family with `setFilter` and names what it operates on. An
   earlier `addValue` was rejected: singular for a parameter that's an array, and it doesn't pair with
   `setFilter` the way `addToFilter` does. Still open to a better alternative.
2. **Scope: all four `ARRAY_VALUE_OPS`, or `in` only for v1?** Leaning `in`-only, for a reason beyond
   "the motivating case is `in`": `addToFilter(field, 'all', [...])` grows an `all` list, and `all`
   with two or more values is unsatisfiable on a single-valued field, exactly the defect the
   catalogue's `isArray` metadata exists to prevent (already gated in `build_sqon`, tracked as tech
   debt where it isn't). Generalizing here ships a primitive whose easiest misuse silently matches
   nothing, in the one operator the repo already knows this about. Correctly gating it would need
   field cardinality metadata this builder-level method has no access to, so `in`-only avoids the
   hazard rather than reproducing it.
3. **Fix `setFilter`'s sign-inversion now, or track it separately from this proposal? Resolved:**
   fix it first. `addToFilter` delegates to `setFilter` and would otherwise inherit the gap; building
   on top of a known-defective primitive isn't worth the time saved.
4. **What should `setFilter`'s fix actually do? Resolved: refuse.** Two silent options were
   considered and rejected, neither is universally safe:
   - *Reach in and mutate/append (today's actual behaviour).* Always sign-inverts, confirmed for both
     the replace path (existing example above) and the append path (no existing match: appending a
     new leaf into `not`'s content still negates it, `not[in:a['x'], in:b['q']]` when `setFilter('b',
     'in', ['q'])` was asked for, `a≠x ∧ b≠q` instead of the requested `b=q`).
   - *Treat the `not` as opaque, compose the new condition alongside under `and`.* Not universally
     safe either: `and[ not[in:a['x']], in:a['z'] ]` = `a≠x ∧ a=z`, which is logically just `a=z`
     whenever `z≠x` (the stale `a≠x` clause becomes a redundant consequence, not wrong) but collapses
     to an always-false, permanently-empty query in the one case where the caller's new value happens
     to equal a value the `not` already excludes on that field (`z=x`), silently, with no signal
     anything went wrong.
   - *A fully correct rewrite* would operator-invert the target leaf so the double negation cancels
     to the positive condition asked for (e.g. substitute `not-in:a['z']` in place of the old child,
     since `¬(a∉{z}) = a∈{z}` is exactly what was requested). This only has a clean single-leaf form
     for half the field ops: `in`↔`not-in`, `gt`↔`lte`, `gte`↔`lt`. `all`, `some-not-in`, `between`,
     and `wildcard` have no single-leaf inverse; a correct rewrite for those would need to expand into
     a sub-combination, well past what a builder convenience method should do silently on a caller's
     behalf.

   No option avoids a silent-wrong-result failure mode for every op and every value. Refusing (throw
   a descriptive `Error` explaining that a `not`'s children are independently negated, so the target
   condition isn't well-defined without the caller resolving that first) is the only option that
   fails loud instead of silently, consistent with this repo's existing preference elsewhere (invalid
   config refusing to start rather than running partially, per the roadmap's OWASP A08 framing).
   `removeFilter` needs no equivalent guard: confirmed correct, including its partial-value-removal
   path (`stripValues`), since removing a value or a whole clause only ever widens under a `not`, and
   subtracting a constraint can't manufacture the kind of collision an added one can.
5. **Interaction with a same-field filter of a *different* op.** If `not-in` already exists on a
   field and `addToFilter(fieldName, 'in', [...])` is called, nothing here proposes merging across
   operators: they'd simply coexist as separate clauses on the same field, exactly as `setFilter`
   already does today for a mismatched op. Confirming that's the right call, not a gap, is part of
   the review.
6. **Does this method change anything about `.in()` chaining, the pattern that actually broke the
   HCMI consumer?** No, and that's deliberate: `.in()`'s `and`-composition is field-agnostic by
   design, and inferring "should a second call to the same field AND or OR" from field cardinality
   alone is exactly the ambiguity the `isArray`-gating tech debt (see Open Question 2) is already
   wrestling with at the `build_sqon` layer, where the caller's intent is more legible. This method is
   additive: it gives a consumer a way to widen correctly, but a consumer who keeps writing
   `.in(field, v1).in(field, v2)` sees no different behaviour after this ships, and no warning either.
   Worth deciding explicitly whether that's acceptable as-is, or whether `.in()` should at least warn
   (dev-mode console warning, JSDoc emphasis) when it detects it's about to `and` a second same-field
   `in` clause.
7. **This method endorses a specific consumer pattern, and that's worth stating rather than assuming.**
   A consumer holding its own `selectedValues` state needs nothing here; `setFilter` already suffices,
   and is likely the majority pattern already in use. `addToFilter` exists for a consumer treating the
   current `SqonNode` itself as its source of truth instead, mutating it incrementally. That's the
   same assumption underlying `modules/components`' flat top-level scan, the separate open item being
   arbitrated with the developer. Shipping this normalizes that pattern a little further; whether
   that's the right direction is a judgment call for the developer, not something to settle silently
   by shipping.

## Out of scope

- Whether/how `modules/components` should adopt this instead of its own hand-rolled
  `combineValues`/`addInValue` helpers. That's downstream of this landing at all, and separately,
  `modules/components`' flat top-level scan not handling a nested-group SQON is its own open item,
  being arbitrated directly with the developer.
- Sorting merged values. Not proposed; matches `.or()`'s existing no-sort behaviour on purpose,
  since consistency with an existing merge path beats introducing a second convention.
