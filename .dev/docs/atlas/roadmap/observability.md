# Observability: metrics and tracing

Detail layer for the corresponding [`.dev/roadmap.md`](../../../roadmap.md) entries. The roadmap carries what each item is and where it stands; this file holds the justification, alternatives considered, prior art, and history. Extracted verbatim 2026-08-18 under `roadmap_split: yes`.

---

## Metrics and tracing

A `/metrics` endpoint (Prometheus format: query latency histograms, error rates, per-catalogue query volume) and distributed tracing spans across the request path (GraphQL resolution, query building, search client call, ES/OS response) would answer operational questions that structured logs alone answer poorly in aggregate: why a given aggregation is slow, or which catalogue is driving load on a shared deployment.

Prior art: [`@opentelemetry/instrumentation-graphql`](https://www.npmjs.com/package/@opentelemetry/instrumentation-graphql) and [`@opentelemetry/instrumentation-express`](https://www.npmjs.com/package/@opentelemetry/instrumentation-express) give auto-instrumentation for most of the request path with minimal manual span creation. [`prom-client`](https://www.npmjs.com/package/prom-client) is the standard Node Prometheus client if metrics are pursued on their own, independent of full tracing.

_Sequencing note: this is easiest to wire in cleanly once [Arranger core module extraction](#arranger-core-module-extraction) and the [GraphQL server migration](#graphql-server-migration-away-from-apollo) land, since both introduce clear seams (the core call boundary, the transport boundary) that are natural instrumentation points. Not blocked on them; doing this afterward just avoids instrumenting code that is about to be restructured anyway._

---

## Prometheus metrics endpoint for catalogue availability

_Surfaced 2026-07-24, during the multicatalogue partial-availability design (see "Multicatalog catalogue lifecycle and metadata" above)._

A `/metrics` endpoint exposing a per-catalogue availability gauge (for example `arranger_catalogue_available{catalogue_id="X"} 1|0`, with the `error.code` as a label when `0`) so the granular "which catalogues are up, which are down, why, and for how long" detail is queryable and alertable via Prometheus/Alertmanager, separate from the boolean liveness/readiness probes. Keeps the health-check surface simple (a k8s probe should stay a boolean) while still making per-catalogue state observable over time, not just at the moment someone happens to hit the introspection endpoint.

_Relationship to existing items: a specific instance of the already-logged "Observability: metrics, tracing, and usage analytics" item (see Architecture section above); recorded here separately because it's tied to a concrete need (multicatalogue status) rather than the general observability gap that item describes. Fold into that item, or keep separate, whichever is clearer once implementation actually starts._

---
