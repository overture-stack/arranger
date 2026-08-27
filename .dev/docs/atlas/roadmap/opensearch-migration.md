# OpenSearch-first migration

Detail layer for the corresponding [`.dev/roadmap.md`](../../../roadmap.md) entry. The roadmap carries what each item is and where it stands; this file holds the justification, alternatives considered, prior art, and history. Extracted verbatim 2026-08-18 under `roadmap_split: yes`.

---

## OpenSearch-first migration

_Priority: high. Next concrete technical effort after documentation._

Arranger currently treats Elasticsearch as the de-facto standard and OpenSearch as an afterthought. This should be reversed: OpenSearch is the actively maintained open-source fork and the direction the community is moving, and it should be the primary supported engine with ES as a supported variant.

The scope is wider than just swapping a client library. It includes the `SearchClient` abstraction in `graphql-router`, the Makefile, `docker-compose` setup for local development, and the integration test suite (which currently runs against ES). The goal is that a developer cloning the repo and running `make dev` gets OpenSearch by default.

The `SearchClient` abstraction already exists as the right boundary; the migration should align the types and default configuration to OpenSearch while preserving compatibility for ES users.

**What's already done:** The integration test suite (`integration-tests/server`) already supports both engines via a `SEARCH_ENGINE` env var (defaults to `'elasticsearch'`). `buildSearchClient` accepts a `client` type parameter mapped to `SupportedClientTypes`. The architecture is ready.

**Corrected 2026-08-17:** this entry previously said the missing pieces were "the OpenSearch client dependency and a running OpenSearch instance in CI." The client dependency is already there: `modules/graphql-router` declares `@opensearch-project/opensearch: ^3.6.0` and has a full `createOpenSearchClient.ts`, with `supportedClientValues` covering both engines. The three real gaps are narrower and are all tracked in `tech-debt.md` rather than here: `integration-tests/server` declares only `@elastic/elasticsearch` and no OpenSearch client; `docker-compose.yml` has no `opensearch` service; and the CI pod runs ES only. A fourth, not previously noted: `@elastic/elasticsearch` is pinned at `^7.17.14` in three places against a current 9.x and is EOL upstream, so the ES side is two majors stale while the OpenSearch side is current.

**CI pod spec:** The current pod runs `elasticsearch:7.17.27` for integration tests. The intent is to keep ES in the pod (to verify ES compatibility) and add an OpenSearch container alongside it, then run the integration suite twice, once per engine. See "Testcontainers for integration tests" below for an alternative approach that avoids hardcoding engine versions in the pod spec.
