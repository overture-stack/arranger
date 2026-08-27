# @overture-stack/arranger-types

Shared Arranger config types, constants, and small framework-agnostic utilities, used across
`graphql-router`, `search-server`, and the client packages so they agree on the same config shape
without depending on each other directly.

## Purpose

- `configs`: the `ConfigsObject` type and its property-name constants (`configRootProperties`,
  `dataFieldProperties`, feature-flag properties, etc.), plus feature-flag config type helpers.
- `elastic`: Elasticsearch/OpenSearch mapping type constants (`ES_TYPES`, the ES-type-to-aggregation
  mapping).
- `tools`: small pure utilities shared across packages, including the GraphQL name sanitizers
  (`sanitizeGraphqlNameSegment`, `sanitizeGraphqlFlatName`) and generic string/type helpers.
- Root export: re-exports the SQON types this package builds on top of.

**No stable release yet.** `npm install @overture-stack/arranger-types` resolves to the `latest`
dist-tag, which only updates on a real release cut and can lag behind current work. Install
`@overture-stack/arranger-types@rc` for the current pre-release build, and check `npm view
@overture-stack/arranger-types dist-tags` before assuming `latest` reflects this README.

## Usage

Import from the subpath you need rather than the root, each maps to its own built entry point:

```ts
import { configRootProperties, type ConfigsObject } from '@overture-stack/arranger-types/configs';
import { ES_TYPES } from '@overture-stack/arranger-types/elastic';
import { sanitizeGraphqlFlatName } from '@overture-stack/arranger-types/tools';
```
