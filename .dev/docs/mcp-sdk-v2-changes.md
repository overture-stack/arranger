# MCP SDK v2 and revision `2026-07-28`: what changed

`apps/mcp-server` moved from `@modelcontextprotocol/sdk@1` to `@modelcontextprotocol/{server,node}@2`
and now speaks protocol revision `2026-07-28` only. The tool, resource and prompt surface is
unchanged. What changed is everything underneath it: the revision removes protocol sessions, the
`initialize` handshake, and the server-to-client request channel, which between them were most of
what the old transport and the confirmation flow were built on.

This is the short read. The decisions, the alternatives rejected, and the probe results that
corrected several of them are in the [upgrade plan](./mcp-sdk-v2-upgrade-plan.md).

## One revision, no fallback

The endpoint serves `2026-07-28` and refuses everything else. A 2025-era client gets an
unsupported-protocol-version error rather than a degraded session.

This is not conservatism. Serving both eras was investigated and does not work here: the SDK's
legacy shim, which is what would have carried confirmation to an old client, consults capabilities
declared at `initialize`, and per-request stateless serving never sees one. The 2025 path would have
given us four working tools and an `execute_query` that cannot ask for confirmation, which is worse
than a clean refusal.

The catch for consumers is that **every SDK client negotiates 2025 by default**. A host must opt into
modern negotiation explicitly or it will be turned away. The MCP Inspector needs
`"protocolEra": "modern"` in its server entry for the same reason.

## Sessions are gone

There is no `Mcp-Session-Id`, no GET stream, no DELETE, and no `Last-Event-ID` resumption. Each
request is served independently by a fresh `McpServer` built for it.

Two files went with them: `http/app.ts`, which existed to manage the session map, and
`utils/inMemoryEventStore.ts`, which existed to replay events into a resumed stream. Nothing needs
reaping at shutdown any more.

Two things that used to be session properties are now per request. Client capabilities arrive in each
request's `_meta` envelope, so a server reads them per call rather than once at connect. Server
instructions, which used to ride the `initialize` response, are now part of `server/discover`.

The cost is that a handler holds nothing between requests. That matters most for the confirmation
flow below.

## Express is gone

`createMcpHandler` returns a web-standard `{ fetch, close }`, and `toNodeHandler` from
`@modelcontextprotocol/node` mounts it on plain `node:http`. Express contributed one thing we
actually used, `express.json({ limit })`, and `http/requestBody.ts` replaces it.

Host and Origin validation come from the SDK as `node:http` guards, so nothing security-relevant was
hand-rolled to make this work. Dropping Express removed its whole transitive tree from the image and
the audit surface.

One deliberate difference from the SDK: binding a routable interface with no Host allowlist **fails
at startup** here, where the SDK only warns. That configuration is exactly what an operator reaches
for when moving from a laptop into a container, and a warning reads as noise.

## Confirmation is two requests now

`execute_query` shows the user the generated GraphQL query and asks them to confirm before it runs.
That used to be a server-initiated `elicitInput()` call the handler awaited. The revision removes the
server-to-client request channel entirely, so servers can no longer ask anything mid-handler.

Instead the handler returns an `input_required` result and the call ends. The client fulfils the
embedded request and re-invokes the tool with the answer attached. The handler runs twice per
confirmed query, from the top both times: introspection re-fetched, validation re-run, query rebuilt.

Two consequences worth knowing:

- **Introspection traffic doubled.** A confirmed query costs four Arranger round trips where it cost
  two. Caching introspection is now load-bearing rather than an optimization, and is tracked in
  `.dev/tech-debt.md`.
- **A client that cannot elicit is refused**, not served unconfirmed. With 2025-era serving gone,
  that was the last remaining route to running a query nobody approved. Confirm-before-execute is an
  invariant of the tool now rather than a best effort, which is what the server instructions and the
  `query_arranger` prompt always claimed it was.

## The approval is bound to the query

Because nothing carries between the two rounds, the second round rebuilds the query from arguments
the client re-sends. Left alone, that means an agent could show one query for confirmation and
execute a different one under the same approval.

The revision's answer is `requestState`: opaque server state the client echoes back. It travels
through the client, so it returns as attacker-controlled input, and the spec makes integrity
protection a MUST wherever it influences business logic. The SDK verifies nothing by default.

We seal a SHA-256 digest of the built query, its variables and its endpoint into `requestState`,
signed with HMAC, and compare it on re-entry. The digest covers what actually runs rather than the
tool arguments, which also catches a subtler case: introspection is re-fetched on round two, so a
catalogue reconfigured between rounds could build a different query from identical arguments.

Three refusals fall out of this, all of them errors rather than fresh confirmation requests, because
re-asking would hand a caller an unlimited retry loop against the gate:

- a `requestState` that fails verification, refused by the SDK seam before the tool is entered;
- a digest that does not match the query this call built;
- an answer carrying no `requestState` at all, refused exactly like a mismatch. Nothing forces a
  client to echo it, so comparing only when present would make the whole binding opt-out.

`MCP_REQUEST_STATE_SECRET` is the signing key. Unset, the server generates one per process, which is
correct at a single replica and fails across several.

## Results carry freshness hints

Six results are cacheable on this revision and must carry `ttlMs` and `cacheScope`:
`tools/list`, `prompts/list`, `resources/list`, `resources/templates/list`, `resources/read` and
`server/discover`. The SDK default of `{ ttlMs: 0, cacheScope: 'private' }` is compliant and tells
every client to cache nothing.

We publish two groups. Results that change only when the server is redeployed get an hour and
`public`. Results that track Arranger's catalogue configuration get a minute and `private`.
`resources/list` is in the second group despite the name, because the catalogue resource is a
template whose listing asks Arranger which catalogues exist.

The scope split is worth understanding before anyone widens it. `private` does not mean "do not
cache", it means "do not share": a client still caches, partitioned by principal, which is where the
benefit is. `public` would only add sharing across principals, and would become a leak the day this
server forwards auth, since catalogue introspection already has a per-caller-filtered mode we do not
read yet.

These are client-side hints on our results. They do nothing for the introspection traffic in front of
Arranger.

## New environment variables

| Variable                   | Why it appeared                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| `MCP_ALLOWED_HOSTS`        | DNS rebinding protection. Required whenever `MCP_HOST` is not loopback, or the server exits at startup. |
| `MCP_ALLOWED_ORIGINS`      | Browser origins allowed to call the server. An empty list is a live check, not a disabled one.          |
| `MCP_MAX_BODY_BYTES`       | Replaces the `100kb` cap `express.json()` used to apply.                                                |
| `MCP_REQUEST_STATE_SECRET` | Signs query confirmations. Optional at one replica, required across several.                            |

Full descriptions are in [`apps/mcp-server/README.md`](../../apps/mcp-server/README.md#environment-variables).
