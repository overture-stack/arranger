# MCP SDK v2 and spec revision `2026-07-28` upgrade

**Status: complete.** All five commits landed on 2026-09-04 and 2026-09-05, each recorded in an "as
built" section below. Decisions 1, 3, 7 and 8 settled 2026-09-03, 5 on 2026-09-04 and 6 on
2026-09-05; 2 and 4 are moot as a consequence. One item is handed off rather than done: the
amendments the [MCP platform testing plan](./mcp-platform-testing.md) needs, listed at the end,
belong to that document's owner.

This is the implementation record, kept for the reasoning behind each decision and for the probe
results that corrected it. For a short read on what changed and why, see
[MCP SDK v2 changes](./mcp-sdk-v2-changes.md).

**Verified 2026-09-03** by installing `@modelcontextprotocol/{server,express,client}@2.0.0` and
reading the shipped type declarations. Every API named below exists as described. Corrections to the
earlier "Crossing the Era Boundary" review are marked inline.

**Goal.** `apps/mcp-server` serves revision `2026-07-28` on SDK v2, with today's surface intact: five
tools (`list_catalogues`, `get_sqon_schema`, `get_catalogue_fields`, `build_sqon`, `execute_query`),
three resources (`arranger_server_introspection`, `arranger_sqon_schema`,
`arranger_catalogue_fields`), one prompt (`query_arranger`), and the confirm-before-execute flow the
prompt describes.

---

## Why this cannot be incremental

We serve `2025-11-25`, the ceiling of `@modelcontextprotocol/sdk@1.29.0` and of 1.30.0, the final v1
release. The target revision removes the `initialize` handshake and protocol-level sessions, which
are the two things `http/app.ts` is built around, and no v1 release implements it.

What we do **not** have to build is backwards compatibility, and per decision 3 we do not serve it
either: the endpoint is `legacy: 'reject'`, modern-only.

**An earlier draft of this section was wrong** and the error is worth keeping visible, because it
was the reason legacy serving looked cheap. It claimed the SDK's legacy shim fulfils multi-round-trip
results for old clients by issuing real server-to-client requests and re-entering the handler. It
does, but **not under `legacy: 'stateless'`**: the shim consults the `initialize`-declared client
capabilities, and per-request stateless serving never sees an `initialize`. Measured, not inferred
(see decision 3). The shim and stateless legacy serving are mutually exclusive, so `'stateless'`
would have bought us four working tools and an `execute_query` that cannot confirm.

---

## Committing: one PR, five commits

**Do not commit this as one change.** Phase A alone touches every file in `src/mcp/` and deletes two
others; folding the confirmation rewrite into that makes the security-relevant diff unreviewable.

**Do not split it across PRs either.** Phases A and B are not independently shippable: after A the
confirmation flow is disabled, which is a functional regression nobody should be able to deploy. One
PR, five commits, reviewable in order.

| #   | Commit                                 | Green?                                                   | Notes                                                                                                      |
| --- | -------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | Swap packages and rewire the transport | **done 2026-09-04**: 302 unit, 84 integration, 2 skipped | also carried the three transport-hardening items decision 1 obliges                                        |
| 2   | Rebuild confirmation as MRTR           | **done 2026-09-04**: 313 unit, 87 integration, 0 skipped | the behavioural rewrite; one era to assert, not two                                                        |
| 3   | Integrity-protect `requestState`       | **done 2026-09-04**: 331 unit, 87 integration, 0 skipped | security; separate so it is reviewed on its own                                                            |
| 4   | Configure what the revision added      | **done 2026-09-05**: 340 unit, 87 integration, 0 skipped | cache hints, `serverInfo`, contract tests; the `x-mcp-header` item was declined, not deferred              |
| 5   | Docs and inspector                     | **done 2026-09-05**                                      | README, `CHANGELOG.md`, `mcp-inspector.json`; the testing-plan amendments are handed off, not applied here |

Commit 1 is the only one that is deliberately feature-incomplete. Say so in its message.

---

## Phase A, commit 1: swap packages and rewire the transport

### Decision 1, SETTLED 2026-09-03: drop Express, serve `handler.fetch` on `node:http`

**Decided.** `apps/mcp-server` takes no Express dependency. `createMcpHandler` returns a
**web-standard** `{ fetch, close, notify, bus }`; a small fetch-shaped router wraps it, and
`toNodeHandler` from `@modelcontextprotocol/node` mounts that router on `node:http`. Host and Origin
validation come from the same package, as plain `node:http` guards.

Two premises in the original three-way comparison were wrong. Both were checked against the
installed packages rather than reasoned from.

- **Hono is not a new dependency.** `@modelcontextprotocol/sdk@1.29.0` already depends on
  `hono@4.12.23` and `@hono/node-server@1.19.14`, so both are in this workspace today. Taking
  `@modelcontextprotocol/node` keeps them; it does not add them. `hono` is an _optional_ peer of that
  package, and the only runtime import is `getRequestListener` from `@hono/node-server`, whose main
  entry never imports `hono` (only its `serve-static` submodule does, which the adapter never
  touches). So `hono` is installed and never loaded.
- **Dropping Express loses nothing security-relevant.** `@modelcontextprotocol/node@2` exports
  `hostHeaderValidation`, `originValidation`, `localhostHostValidation` and
  `localhostOriginValidation` as plain `node:http` guards: `(req, res) => boolean`, having already
  answered `403` when false. `@modelcontextprotocol/server@2` carries the runtime-neutral core that
  every framework adapter wraps: `validateHostHeader`, `validateOriginHeader`, `requireBearerAuth`,
  `verifyBearerToken`, `bearerAuthChallengeResponse`, `oauthMetadataResponse`,
  `createRequestStateCodec`. The `originValidation` docstring names `@modelcontextprotocol/node`
  alongside the express, hono and fastify adapters, so it is a first-class adapter, not a fallback.

Fresh-install footprint, measured:

| Wiring                                    | packages | size    |
| ----------------------------------------- | -------- | ------- |
| today, `@modelcontextprotocol/sdk@1.29.0` | 94       | 26M     |
| `server` + `express` adapter + express 5  | 74       | 19M     |
| **`server` + `node`, chosen**             | **6**    | **18M** |
| `server` only, hand-written bridge        | 3        | 15M     |

Express alone pulls 64 transitive packages, which is where its advisory history lives
(`path-to-regexp`, `qs`, `body-parser`, `send`, `cookie`). `@hono/node-server` pulls zero.

The hand-written bridge was rejected as a false economy. `toNodeHandler` is about sixty lines, but
its careful parts are abort-on-close, SSE write backpressure via `drain`, and `content-length`
recomputation for pre-parsed bodies. That is the exact bug class a streaming transport cannot afford
to own, in a package that is already in the tree.

Two things Express was assumed to provide and does not: `createMcpExpressApp` never calls `cors()`
(the `cors` dependency is used only inside `mcpAuthMetadataRouter`, for the OAuth well-knowns), and
`mcpAuthMetadataRouter` has a one-call fetch-layer equivalent in `oauthMetadataResponse`, which
already emits permissive CORS, `405` with `Allow`, and `204` preflight.

**Correction to the earlier review, retained:** it showed `createMcpExpressApp` and `toNodeHandler`
used together as though the Express adapter bridged the handler. It does not.
`@modelcontextprotocol/express@2` exports `createMcpExpressApp` plus auth and host-validation
middleware (`hostHeaderValidation`, `localhostOriginValidation`, `requireBearerAuth`, and so on); the
bridge is only in `@modelcontextprotocol/node`.

#### The shape

A health probe and the OAuth well-knowns are the usual reason to keep a router, and both are likely
here. Both compose at the fetch layer, so the whole app stays one `http.createServer`:

```ts
const router = {
	fetch: async (request: Request, options?: McpHandlerRequestOptions): Promise<Response> => {
		const { pathname } = new URL(request.url);
		if (pathname === HEALTH_PATH) return Response.json({ status: 'ok' });
		return oauthMetadata(request) ?? handler.fetch(request, options);
	},
};

const serve = toNodeHandler(router, { onerror: (error) => logger.error({ error }, 'MCP adapter error') });

http.createServer(async (req, res) => {
	if (!validateHost(req, res)) return;
	if (!validateOrigin(req, res)) return;
	const body = await readCappedJsonBody(req, res, config.mcp.maxBodyBytes);
	if (body === REJECTED) return;
	await serve(req, res, body);
}).listen(port, host);
```

`toNodeHandler` takes any `{ fetch }` structurally, and the type is documented as staying structural
so hand-wired compositions work, which makes the router a supported use rather than a workaround.
`/health` sits outside `handler.fetch` deliberately: a readiness probe should still answer while the
handler is closing.

#### Later: when auth lands, still out of scope for this PR

Recorded because it was the main objection to dropping Express, and it does not survive contact with
v2.

v1 shipped a full authorization server behind Express: `mcpAuthRouter`, `OAuthServerProvider`, and
handlers for `authorize`, `token`, `register` and `revoke`, all Express-only and all using
`express-rate-limit`. **v2 ships none of it.** `@modelcontextprotocol/express@2` exports only
`createMcpExpressApp`, the host and origin guards, `requireBearerAuth`, `mcpAuthMetadataRouter` and
`getOAuthProtectedResourceMetadataUrl`. Being an authorization server is a separate service now, on
either path.

For the resource-server side, Express's `requireBearerAuth` is documented as "the Express adapter
over the runtime-neutral core in `@modelcontextprotocol/server`", and `BearerAuthMiddlewareOptions`
is a type alias for `BearerAuthOptions`. Same capability, both paths:

| Express                                      | `node:http` + fetch                                                                                                                                   | From     |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `requireBearerAuth(opts)` sets `req.auth`    | `requireBearerAuth(opts)(request)` returns `AuthInfo \| Response`, or `verifyBearerToken(header, opts)` plus `bearerAuthChallengeResponse(err, opts)` | `server` |
| `mcpAuthMetadataRouter(opts)`, with `cors()` | `oauthMetadataResponse(request, opts)` returns `Response \| undefined`                                                                                | `server` |
| `getOAuthProtectedResourceMetadataUrl`       | same function                                                                                                                                         | both     |

The handoff into the handler is identical. `toNodeHandler` forwards `req.auth` as `handler.fetch`'s
`authInfo` (`NodeIncomingMessageLike.auth` is declared as validated info "attached by upstream
middleware"), and it reaches tool handlers as `ctx.http?.authInfo`. So our wiring assigns `req.auth`
exactly as Express middleware would.

One advantage the composed path gains: `verifyBearerToken` takes a raw `Authorization` header string,
so auth can run **before** the body is read.

```ts
try {
	req.auth = await verifyBearerToken(req.headers.authorization, bearerOptions);
} catch (error) {
	return writeResponse(res, bearerAuthChallengeResponse(error, bearerOptions));
}
```

`createMcpExpressApp` cannot do that: it mounts `express.json()` first and app-wide, so an
unauthenticated caller still gets the full body limit buffered before `requireBearerAuth` runs.

When auth does land, configure the bearer gate and the OAuth metadata endpoint as a pair.
`bearerAuthChallengeResponse` advertises `resource_metadata` in its `WWW-Authenticate` challenge only
when `resourceMetadataUrl` is set, and that is what lets an unauthenticated client discover the
authorization server from the `401`.

#### Why this stays reversible

v2 ships no rate limiting, and `express-rate-limit` has no `node:http` drop-in. If per-token or
per-IP limits become a requirement inside the app rather than at the gateway, Express comes back, and
it costs about ten lines: `toNodeHandler` returns a function that is already valid Express
middleware, and its docstring states that a function third argument (Express's `next`) is ignored and
never treated as a body.

```ts
app.use(rateLimit({ ... }));
app.use(express.json({ limit }));
app.post(config.mcp.path, toNodeHandler(router));
```

The router, the guards, the auth gate and every tool file are untouched by that change. Re-adding
Express when a concrete middleware need appears is cheaper than carrying 64 transitive packages
against a hypothetical one.

### Decision 2, MOOT: which Express major, if Express stays

Closed by decision 1: Express does not come back. This app stops being gated on the root `overrides`
pin of `@types/express` to `4.17.25`, which now constrains only `apps/search-server` and
`modules/graphql-router`. That is what the tech-debt entry from `c18a5a2e` predicted would resolve
here. Drop `@types/express` from `apps/mcp-server`'s `devDependencies`.

### Decision 3, SETTLED 2026-09-03: serve one revision only, `legacy: 'reject'`

**Decided.** `createMcpHandler(factory, { legacy: 'reject' })`. The endpoint serves `2026-07-28` and
nothing else. This supersedes the narrower question the decision started as (signing off on lost
legacy resumability); the sign-off now covers dropping 2025-era serving entirely, which is a larger
commitment and still someone's to own.

**Why it got bigger.** The premise that legacy clients keep the confirm-before-execute flow is false
in the configuration we would have shipped. Measured end to end: a tool returning `inputRequired(...)`
behind `legacy: 'stateless'`, called by a client that declares `elicitation` and answers it, gets

```text
{"content":[{"type":"text","text":"Cannot request input 'confirm' (elicitation/create): the client
on this 2025-era connection did not declare the required capability (no client capabilities are
available on this connection - per-request legacy serving cannot receive server-to-client
requests)"}],"isError":true}
```

while the same server answers a client pinned to `2026-07-28` correctly. The SDK states the mechanism
in the `Server` internals: "Per-request instances that never saw an initialize (stateless legacy)
hold nothing, so gates refuse there." **The legacy shim and stateless legacy serving are mutually
exclusive**, and getting the shim would mean a sessionful legacy wiring, which this decision already
rejected as both SDK majors in one process.

Everything else does work on the legacy path. The full non-confirming surface was checked:

|                                                                               | legacy client          | modern pinned client |
| ----------------------------------------------------------------------------- | ---------------------- | -------------------- |
| `tools/list`, `tools/call`, `resources/list`, `resources/read`, `prompts/get` | OK                     | OK                   |
| server instructions                                                           | delivered              | delivered            |
| `GET` / `DELETE` on the endpoint                                              | 405                    | 405                  |
| multi-round-trip input                                                        | **refused, `isError`** | works                |

So the real choice was between these, not between resumable and non-resumable:

|                                                           | Legacy clients get                              | Confirmation             | Cost                                      |
| --------------------------------------------------------- | ----------------------------------------------- | ------------------------ | ----------------------------------------- |
| A. `'stateless'`, skip confirmation when unsupported      | four tools plus **unconfirmed** `execute_query` | **downgrade-defeatable** | shim testing stays, decision 4 stays live |
| B. `'stateless'`, refuse `execute_query` when unsupported | four tools plus a fifth that always errors      | enforced                 | confusing surface, two eras to test       |
| **C. `'reject'` (chosen)**                                | a `-32022` naming `supported: ["2026-07-28"]`   | enforced, one path       | only opted-in clients connect             |
| D. C behind a config flag                                 | operator's choice                               | mode-dependent           | ships a documented downgrade path         |

Option A is the one to name and reject explicitly: it turns confirm-before-execute into a control any
client removes by connecting with an older handshake, while the prompt and the docs keep claiming it
exists. Option D was rejected for the same reason in weaker form. This server is consumed by our own
client and host application, so what legacy serving buys is reach we do not need, and what it costs
is a security property we do.

**What `'reject'` answers.** Legacy-classified requests get a clean, discoverable error rather than a
mystery failure; legacy-classified notifications are acknowledged `202` and dropped.

```text
{"jsonrpc":"2.0","error":{"code":-32022,"message":"Unsupported protocol version: 2025-11-25",
 "data":{"supported":["2026-07-28"],"requested":"2025-11-25"}},"id":0}     HTTP 400
```

**The catch that applies either way.** `@modelcontextprotocol/client@2` defaults to
`versionNegotiation.mode: 'legacy'`: "absent (or `mode: 'legacy'`), `connect()` runs the plain 2025
sequence, byte-identical to today's behavior (no probe, no new headers). Opt into `'auto'` or pin to
talk to a 2026-07-28 server." Nothing speaks modern by accident, including our own integration
tests, which must set `versionNegotiation: { mode: { pin: '2026-07-28' } }` or they will silently
cover the wrong era. Our host application needs the same opt-in.

Also still true, and now simply a consequence rather than the decision: GET and DELETE return 405,
there is no session resumption or SSE replay, and `InMemoryEventStore` (which our own source
annotates as not production-suitable) is deleted.

### The work

- Run `npx @modelcontextprotocol/codemod@latest v1-to-v2`, then review every hunk. It does the
  mechanical import and API renames, and none of the three hardening items below.
- `package.json`: drop `@modelcontextprotocol/sdk` and the `@types/express` devDependency; add
  `@modelcontextprotocol/server@^2` and `@modelcontextprotocol/node@^2`.
  `@modelcontextprotocol/core` arrives transitively (`server` pins it at exactly `2.0.0`) and need
  not be declared. `zod` is already `^4.2.0`.
- **Delete** `src/http/app.ts` and `src/utils/inMemoryEventStore.ts`, with the `transports` map,
  `sessionHandler`, and `closeAllSessions`.
- `src/server.ts`: build the handler from a per-request factory over the existing
  `createMcpServer(deps)` with `{ legacy: 'reject' }` (decision 3), wrap it in the fetch router, and
  mount it with `toNodeHandler` on `http.createServer`. Shutdown becomes `await handler.close()`
  followed by closing the http server.
- `src/mcp/*.ts`: import paths, `extra` becomes `ctx`, and raw `inputSchema` shapes wrap in
  `zod.object()`. `ResourceTemplate` and `registerResource` keep their shape.
- **Temporarily disable confirmation** in `execute_query` so the suite can run. Commit 2 restores it.
- `integration-tests/mcp-server`: client moves to `@modelcontextprotocol/client@2`, **and must set
  `versionNegotiation: { mode: { pin: '2026-07-28' } }`**. That client defaults to `mode: 'legacy'`,
  so without the pin every test would connect 2025-era and be rejected outright by decision 3's
  endpoint. Pin rather than `'auto'`: `'auto'` falls back silently, which is exactly the failure the
  suite exists to catch. `startMcpServer.ts` is built on `createHttpApp`'s
  `{ app, closeAllSessions }` return, which no longer exists. It already returns an `http.Server`, so
  it takes the new wiring's `{ httpServer, close }` instead; a smaller change than it looks.

#### What decision 1 obliges, each worth its own test

**1. A request body cap.** `createMcpHandler` has no body-size option, and `toWebRequest` reads the
request stream to completion with no limit, so `express.json()`'s implicit `100kb` cap disappears
along with Express. Read with a byte counter, answer `413` past the limit, `JSON.parse`, and hand the
parsed object to `toNodeHandler` as `parsedBody` (it re-serializes and fixes `content-length`, the
same path Express takes today). New env var, defaulted above our largest legitimate `execute_query`
payload.

**2. `MCP_ALLOWED_HOSTS` and `MCP_ALLOWED_ORIGINS`.** This fixes a live defect, not a migration
artifact. `createHttpApp` calls `createMcpExpressApp()` with no options, so `host` defaults to
`'127.0.0.1'` and `localhostHostValidation()` is applied, while the process binds every interface.
Verified against the installed v1 SDK:

```text
Host: 127.0.0.1:59791    -> 200 {"ok":true}
Host: arranger-mcp:59791 -> 403 {"error":{"code":-32000,"message":"Invalid Host: arranger-mcp"}}
Host: mcp.example.org    -> 403 {"error":{"code":-32000,"message":"Invalid Host: mcp.example.org"}}
```

The `mcp-server` stage of `docker/Dockerfile.jenkins` exposes 3100, so a peer container reaching it
as `arranger-mcp:3100` gets a `403` today. Deployment topology is undecided (proxied, direct, or
both), so the app should **fail fast at startup** when it binds a routable interface with no
allowlist configured, with an explicit `MCP_ALLOWED_HOSTS=*` opt-out for "a gateway owns this". That
is stricter than the SDK's `console.warn`, and it cannot regress an existing deployment because no
non-localhost deployment works today. Operator-facing, so it belongs in `CHANGELOG.md`.

Leave `MCP_ALLOWED_ORIGINS` unset meaning an empty allowlist, not a disabled check.
`originValidation([])` passes requests carrying no `Origin` (every non-browser MCP client) and
rejects any browser origin, which is the right default for a server with no browser clients and
needs no special-casing.

**3. `server.ts` honouring `config.mcp.host`.** It calls `app.listen(port)` today and ignores the
configured host, so `MCP_HOST` is decorative. On `node:http` we pass both, which also means the host
we validate against and the interface we bind derive from the same config.

**Not in scope, file as tech debt:** `docker/Dockerfile.jenkins` copies the entire hoisted
`node_modules` into the `mcp-server` stage, so express, apollo and the graphql router ship in that
image whatever this app's manifest says. Trimming the manifest shrinks what we declare and audit; it
will not shrink the image until that stage installs per-workspace.

**Done when:** the existing integration suite passes with confirmation disabled, and the body cap,
the allowlist fail-fast, and a non-localhost `Host` reaching the MCP endpoint are each pinned by a
test.

### Commit 1 as built, 2026-09-04

Built, reviewed and staged. 31 files: 24 modified, 2 deleted, 4 new, plus the lockfile. Green at
302 unit tests, 84 integration tests, 2 skipped. Not committed at time of writing.

**Where it differed from the plan above.**

- **No fetch router.** The plan sketched a `{ fetch }` wrapper hosting `/health` and the OAuth
  well-knowns alongside `handler.fetch`. Neither is decided, so a router would have been an empty
  wrapper; `toNodeHandler(handler)` mounts directly and the router stays a one-line insertion point.
- **`ping` is gone from this revision**, and the SDK refuses it client-side before the wire, so the
  integration suite's liveness probe became `server/discover`.
- **Prompt argument errors changed shape.** v1 quoted the failing path as `"goal"`; v2 renders it
  `query_arranger: goal: Too small`. The assertion now pins the prompt-name-then-path shape rather
  than Zod's issue wording.
- **`@modelcontextprotocol/client@2` was added as a devDependency of `apps/mcp-server`** for the
  transport positive control. Dev-only, so `npm ci --omit=dev` keeps it out of the image.
- **`.env.schema` binds `0.0.0.0` with explicit allowlists** rather than binding loopback, so the
  template models the deployment shape (bind broadly, allowlist explicitly) instead of a local
  special case that contradicted the documented default.

**Choices accepted in review that remain revisitable.** None of these are settled decisions; they
are judgment calls with a live counter-argument, recorded so they are not mistaken for consensus.

- **The startup fail-fast is stricter than the SDK**, which only `console.warn`s on a routable bind
  with no allowlist. Accepted because a missing env var then surfaces as a pod that will not start,
  and nothing can be deployed unprotected. The counter stands: it turns an optional protection into
  a required variable, and "forgot to add the new ingress hostname" reproduces the same `403` this
  commit fixed, relocated rather than removed. One `superRefine` block to soften.
- **`MCP_MAX_BODY_BYTES` defaults to `102_400`, which is preserved behaviour rather than a measured
  ceiling.** An earlier draft used 1 MiB, loosening the enforced limit tenfold on no evidence; that
  was reverted deliberately. Raise it only against a real payload, such as an `execute_query` SQON
  filtering on a very large identifier set.
- **`MCP_ALLOWED_ORIGINS` is the weakest of the three new variables.** There are no browser clients,
  and leaving it unset already behaves correctly. Kept because Origin is the other half of the DNS
  rebinding defense and costs little, but it is the first thing to drop if the surface is judged too
  wide.

**Test gaps left open knowingly.** None block commit 1; recorded so they are not rediscovered as
surprises.

- Nothing asserts that an oversized body is **cut off mid-stream** rather than fully buffered. That
  is what `req.destroy()` is for, and an implementation that buffered everything and then answered
  `413` would pass every test written.
- No config edge cases: whitespace-only allowlists, `MCP_ALLOWED_HOSTS='*,foo'` (`*` wins, which is
  undocumented), `MCP_HOST=::`.
- Shutdown is smoke-covered only. Nothing asserts in-flight request behaviour or that `close()` is
  idempotent.
- `readCappedJsonBody` has no direct unit test; it is reached only through the server.

**Deliberately still commit 5.** `README.md` continues to say v1.x and to list `http/app.ts` and
`utils/inMemoryEventStore.ts` in its folder structure; `CHANGELOG.md` and `mcp-inspector.json` are
untouched. Only the README's environment-variable table moved, because commit 1 introduced the
variables it documents.

**Pre-existing, not fixed.** `integration-tests/mcp-server/tsconfig.json` sets no `strict`, so
discriminated unions do not narrow there and it already failed on `main`. Nothing runs it. New code
was written to be clean under it regardless.

### What commit 2 inherits

- `confirmExecution()` in `executeQueryTool.ts` is a stub returning `true`, and the call site is
  intact (`const confirmed = confirmExecution(); if (!confirmed) { ... }`), so the decline path and
  its `executed: false` result shape are still there to rebuild against.
- `integration-tests/mcp-server/test/executeQuery.ts` tests 14 and 15 are `test.skip` with their
  assertions unchanged. They describe the behaviour the rewrite has to reproduce.
- `connectElicitingClient` in that file already registers its handler by method name
  (`'elicitation/create'`) and already carries the modern pin, so only the assertions move.
- Decision 8 governs the remaining branch: a modern client that does not declare `elicitation` must
  be **refused**, not served unconfirmed. The old skip-when-unsupported behaviour does not survive.

---

## Phase B, commit 2: rebuild confirmation as MRTR

`confirmExecution` calls `server.server.elicitInput()` at
[`executeQueryTool.ts`](../../apps/mcp-server/src/mcp/executeQueryTool.ts)
and awaits the answer. Servers can no longer initiate requests. The handler instead returns an
`InputRequiredResult`, the call ends, and the client re-invokes the tool with the answer attached.

Verified API: `inputRequired` is an exported builder; `acceptedContent(responses, key, schema?)`
reads the reply, and its schema-aware overload validates against any Standard Schema, so a Zod object
works and the untrusted client value arrives typed.

Three consequences:

- **The handler must survive re-entry.** On retry it re-runs from the top: introspection fetched
  again, validation again, GraphQL query rebuilt. A confirmed query therefore costs four Arranger
  round trips where it cost two, so introspection caching becomes load-bearing rather than an
  optimization. **No commit in this plan owns it**, because it is a server-side concern that predates
  this migration and is only amplified by it; it is tracked in `.dev/tech-debt.md` under
  `apps/mcp-server` instead.
- **Nothing carries over except `requestState`.** Anything the second call needs is encoded there or
  re-derived from the re-sent arguments.
- **The capability check moves** from `server.server.getClientCapabilities()` at
  [`executeQueryTool.ts`](../../apps/mcp-server/src/mcp/executeQueryTool.ts)
  to `ctx.mcpReq.envelope?.clientCapabilities`. The rule holds: MUST NOT send an input request to a
  client that did not declare `elicitation`. What changes is what we do about it: see decision 8.

**Decision 8, SETTLED 2026-09-03: `execute_query` refuses a client that cannot elicit.** The
skip-when-unsupported branch does **not** survive. With legacy serving gone (decision 3), a modern
client that omits `elicitation` from its request envelope is the only remaining way to reach
`execute_query` without confirmation, and silently executing there would leave the same
downgrade-shaped hole that decision 3 closed, just narrower. The tool returns an error telling the
client it must support elicitation. That makes confirm-before-execute an invariant of the tool rather
than a best effort, which is what `SERVER_INSTRUCTIONS`, the `query_arranger` prompt, and the README
all already describe it as.

**Decision 4 is moot**, closed by decision 3. `ServerOptions.inputRequired.maxRounds` (default 8) is
documented as "handler re-entries per originating request **before the shim fails**", so it only ever
governed the legacy shim, which `legacy: 'reject'` never runs. Note the identically-named client-side
knob is a different thing and still live: `ClientOptions.inputRequired.maxRounds` (default 10) caps
the auto-fulfilment driver's rounds and belongs to our host application's configuration, not this
server's.

**Done when:** confirmation works on a modern client, asserted once, and a modern client that does
not declare `elicitation` is refused rather than served, asserted separately.

### Commit 2 as built, 2026-09-04

Built and green: 313 unit tests (up from 302), 87 integration tests, nothing skipped. Tests 14 and 15
are restored and a new test 22 pins the refusal.

**Correction to this plan.** `ctx.mcpReq.envelope?.clientCapabilities` does not exist. The envelope
carries the reserved keys verbatim, so the capability read is
`envelope['io.modelcontextprotocol/clientCapabilities']`, via the exported
`CLIENT_CAPABILITIES_META_KEY`. `RequestMetaEnvelope` is typed as an open object, so the value is
narrowed in user land rather than typed. Measured with a probe, not read off the declarations.

**`inputResponse()` carries the flow, not `acceptedContent()` alone.** `acceptedContent` returns
`undefined` for a missing key, a decline, a cancel, and content that fails the schema, which makes
the first round indistinguishable from a refusal. `inputResponse()` returns a discriminated view
(`missing` / `elicit` with an `action`), so the handler asks on `missing`, refuses on anything that
is not an accepted `confirm: true`, and validates the accepted content with the schema-aware
`acceptedContent` overload.

**No `requestState`, deliberately.** The approval is not yet bound to what was approved: re-entry
rebuilds the query from the arguments the client re-sends, so an agent could show one query for
confirmation and re-enter with different ones. That is commit 3's job and is flagged in
`resolveConfirmation`'s doc comment. Splitting it this way is deliberate rather than incremental: an
unauthenticated digest is worthless, since the integrity comes from the HMAC, so the digest and the
codec have to land together.

**The shared integration client now approves.** Decision 8 would otherwise refuse every
`execute_query` test, since that client declared no capabilities. `connectApprovingClient` declares
`elicitation` and auto-accepts, which has the useful side effect that every `execute_query` test now
exercises the two-round exchange rather than only tests 14 and 15.

**Unit coverage added** in `executeQueryTool.test.ts`, driving the registered handler with a stubbed
Arranger client and a synthetic context. It pins the states the integration suite cannot reach
because a well-behaved client never sends them: an accepted answer whose `confirm` is not a boolean,
an accepted answer with no content, and a response shape the SDK could not read (which must re-ask
rather than count as approval or refusal). It also asserts the refusal costs no Arranger round trip.

---

## Phase B, commit 3: integrity-protect `requestState`

Separate commit because it is the security-relevant change and should be reviewed as one.

`requestState` travels through the client and returns as attacker-controlled input. Today the query
the user approves is the query we run, because it never leaves the process. Encode the built GraphQL
query into `requestState` and execute what comes back, and a tampered value executes something the
user never saw. The spec makes integrity protection a **MUST** where the state influences
authorization, resource access, or business logic, and the SDK provides no default verification.

### Decision 5, SETTLED 2026-09-04: what goes into `requestState`

**Verified 2026-09-04** against `createRequestStateCodec`, by probe rather than by docstring. The
codec is richer than this plan assumed, and three of the four fields it recommended do not belong in
the payload at all.

| Probe                                                   | Result              |
| ------------------------------------------------------- | ------------------- |
| valid, same bind                                        | returns the payload |
| tampered mac, tampered payload                          | throws `mac`        |
| different principal, absent principal, different method | throws `bind`       |
| garbage                                                 | throws `malformed`  |
| 3s past `ttlSeconds: 1`                                 | throws `expired`    |

A caution for whoever re-runs this: `exp` has one-second granularity, so a 1.5s wait against
`ttlSeconds: 1` can still land on the mint second and read as a **false** "expiry does not work".
Leave a margin of several seconds.

**What the codec already does, so we do not:**

- **Expiry is `ttlSeconds`, not a payload field.** Default 600 seconds, which we keep. No env var:
  a one-line change if a confirmation window ever needs tuning.
- **The principal belongs in `bind`, not the payload.** `bind` is evaluated at mint and again at
  verify, and is stored as a domain-separated HMAC tag, so the identifier never reaches the wire.
- **The payload is signed, not encrypted.** Decoded straight off the wire in the probe:
  `{"p":{"digest":"..."},"exp":1788563528,"b":"mU1qn..."}`. Nothing secret may go in it.

**The constraint this plan did not anticipate:** `bind(ctx)` receives a `ServerContext`, which has no
access to the tool arguments. The approved-query digest therefore cannot live in `bind` and be
compared by the SDK. It goes in the payload, and our handler does the comparison.

**Settled shape.** Payload is `{ digest }` and nothing else.

- **The digest covers the built query, its variables and the endpoint**, not the tool arguments.
  That is what actually runs and what the confirmation message displayed. It also catches drift we
  would otherwise miss: introspection is re-fetched on round two, so a catalogue reconfigured between
  rounds could build a different query from identical arguments and run it under the old approval.
- **`bind` is** `` ctx => `${ctx.mcpReq.method}\0${ctx.http?.authInfo?.clientId ?? ''}` ``, the SDK's
  documented shape. With auth out of scope the principal is always empty, so today it only separates
  methods. It starts separating principals the moment auth lands, with no code change here.
- **Key:** `MCP_REQUEST_STATE_SECRET` when set (the codec requires at least 32 bytes and throws a
  `RangeError` below that), otherwise a random 32-byte per-process key plus a startup warning naming
  the consequence. Single replica today, so a per-process key is correct and costs no configuration;
  it is secure, just not horizontally scalable. Under more than one replica, round one mints on pod A
  and round two verifies on pod B, which fails `mac` and surfaces as an intermittent `-32602` that
  reads like a bug. A process restart also invalidates in-flight confirmations, and the user simply
  re-confirms.
- **On digest mismatch: refuse** with an error naming the mismatch, rather than re-asking. Re-asking
  would hand a caller an unlimited retry loop against the confirmation gate.

**A hole to close explicitly.** An answer may arrive with `requestState` **absent**: nothing forces a
client to echo it. If the handler only compares when the state is present, the whole binding is
opt-out and this commit achieves nothing. Once an answer is present, a missing `requestState` must be
refused exactly like a mismatched one.

Plain `===` for the digest comparison. The digest is not a secret, since it is readable on the wire,
so a constant-time compare buys nothing; the codec already uses constant-time comparison where it
matters, for the mac and the bind tag.

### How it wires up

- **Construct the codec once at startup**, in `startServer`, and pass it into `createMcpServer` as a
  dependency alongside `config` and `client`. **Not inside the factory.** The factory builds one
  `McpServer` per HTTP request and each round is a separate request, so a codec built there mints
  round one under one per-process key and verifies round two under another, failing `mac` on every
  confirmation. It only bites when `MCP_REQUEST_STATE_SECRET` is unset, which is the local dev path,
  so it presents as "the feature is broken" rather than "the wiring is wrong". This is the single
  most expensive mistake available in this commit.
- **`codec.verify` passes straight through** as `ServerOptions.requestState.verify` on the
  `McpServer` constructor, beside `instructions`. The seam runs it before the handler on every round
  whose echoed `requestState` is a string, and any throw becomes the frozen `-32602`
  `"Invalid or expired requestState"`. The thrown reason (`malformed` / `mac` / `expired` / `bind`)
  reaches the server's `onerror` only and never the wire, so operators can tell the cases apart and
  clients cannot.
- **Minting:** `await codec.mint({ digest }, ctx)`, returned as
  `inputRequired({ requestState, inputRequests })`. `ctx` is required because a `bind` is configured.
- **Reading:** `ctx.mcpReq.requestState<{ digest: string }>()`. The handler never calls `verify`
  itself; the seam already did, and the accessor yields the decoded payload precisely because the
  hook resolved with it.
- **`resolveConfirmation` changes shape.** Commit 2 left it as `(ctx, message) => Confirmation`. It
  now also needs the digest of the query being confirmed, to mint on the first round and compare on
  the second, so the mismatch and missing-state refusals sit beside the existing decline path rather
  than in the caller.
- **Serialize the digest input deterministically.** `JSON.stringify` over
  `{ endpoint, query, variables }` is insertion-ordered and stable within a build, which is
  sufficient. The note exists so nobody substitutes a serializer that reorders keys and silently
  breaks every re-entry.

### The new environment variable

`MCP_REQUEST_STATE_SECRET` follows the precedent commit 1 set for `MCP_ALLOWED_HOSTS`: a new variable
updates `.env.schema` and the README environment-variable table **in the same commit**, not in
commit 5. The README description should carry the reasoning that lives here, in particular that
leaving it unset is fine at one replica and breaks confirmations across several.

**Done when:** a tampered `requestState` is refused rather than executed, an answer arriving with no
`requestState` is refused, and a query rebuilt differently from the one approved is refused. Each
pinned by a test. The unit suite is the place for all three, since none of them need Elasticsearch.

### Commit 3 as built, 2026-09-04

Built and green: 331 unit tests (up from 313), 87 integration tests, nothing skipped. All three
done-when cases are pinned, and the plan's shape survived: payload is `{ digest }`, `bind` is the
documented method-plus-principal shape, the codec is built in `startServer`, and `codec.verify` is
passed straight through as `ServerOptions.requestState.verify`.

**`ctx.http.authInfo` does exist**, contrary to what a reading of `ServerContext` alone suggests.
`ServerContext` intersects two `http` shapes, and `authInfo` is on the one declared in `BaseContext`,
so the documented `bind` expression type-checks unchanged.

**A test-only export was avoided, and the wiring is asserted end to end instead.** Nothing public
reads back `ServerOptions.requestState.verify` (`Server._requestStateVerify` is private), so the
seam test drives the real HTTP endpoint with `fetch` and asserts a `requestState` altered in transit
is answered `-32602` with `data.reason: 'invalid_request_state'` before `execute_query` is entered.

**An in-memory transport cannot reach the multi-round-trip flow at all**, which cost an hour to find
and is worth recording. A `Server` on `InMemoryTransport.createLinkedPair()` serves the 2025 era
regardless of what the request's `_meta` envelope claims: the negotiated revision is set by the HTTP
entry from the `Mcp-Protocol-Version` header, and `setNegotiatedProtocolVersion` is internal to
`@modelcontextprotocol/core` rather than exported. Every 2026-era unit test therefore goes over
`startMcpHttpServer` or drives the registered handler directly.

**Driving `tools/call` by hand needs three headers, not one.** `Mcp-Protocol-Version` classifies the
era, and `Mcp-Method` and `Mcp-Name` are required of every modern call: without them the request is
answered `-32020` as a headers-versus-body mismatch, before any handler runs. This is SEP-2243
enforcement at the HTTP entry, and it is easy to mistake for a malformed body.

**The handler is fail-closed even if the seam hook is ever dropped.** With no `verify` configured the
accessor yields the raw wire string, whose `digest` is `undefined`, so an altered state is refused by
the handler's own check rather than executed. The hook still earns its place: it is what enforces
expiry and the binding, neither of which the handler can see.

**`SERVER_INSTRUCTIONS` was corrected here rather than deferred to commit 5.** It still told the model
that a client without elicitation gets no prompt, describing the branch decision 8 replaced with a
refusal in commit 2, and it now also states that an approval covers one exact query. The
`query_arranger` prompt needed no change: its confirmation language is about the model's own
conversational step, not about elicitation.

---

## Phase C, commit 4: configure what the revision added

- **Cache hints.** `cacheHints?: Partial<Record<CacheableResultMethod, CacheHint>>` on the `McpServer`
  constructor. The cacheable set is closed and verified: `tools/list`, `prompts/list`,
  `resources/list`, `resources/templates/list`, `resources/read`, `server/discover`. `CacheHint` is
  `{ ttlMs?, cacheScope? }`, and **invalid values throw a `RangeError` at construction**, so a wrong
  value fails fast rather than at request time. The SDK default is `{ ttlMs: 0, cacheScope: 'private'
}`: compliant, but it throws the feature away.

        **Decision 6, SETTLED 2026-09-05: the hint values.**

        | Method                     | `ttlMs`     | `cacheScope` |
        | -------------------------- | ----------- | ------------ |
        | `tools/list`               | `3_600_000` | `public`     |
        | `prompts/list`             | `3_600_000` | `public`     |
        | `resources/templates/list` | `3_600_000` | `public`     |
        | `server/discover`          | `3_600_000` | `public`     |
        | `resources/list`           | `60_000`    | `private`    |
        | `resources/read`           | `60_000`    | `private`    |

        **Verified 2026-09-05** by probe, as this section demanded, and the plan's own grouping was one of
        the things the probe corrected.

        | Probe                                                                   | Result                                                                      |
        | ----------------------------------------------------------------------- | --------------------------------------------------------------------------- |
        | `ttlMs` of `-1`, `1.5`, `Infinity`, `MAX_SAFE_INTEGER + 1`              | `RangeError` at construction                                                |
        | `ttlMs` of `0` or `MAX_SAFE_INTEGER`                                    | accepted                                                                    |
        | `cacheScope` other than `public` / `private`                            | `RangeError` at construction                                                |
        | a method key that is not cacheable, e.g. `tools/call`                   | **accepted silently, and does nothing**                                     |
        | configured hint on each of the six cacheable methods                    | reaches the wire verbatim                                                   |
        | per-resource `cacheHint` against the server-level `resources/read` hint | overrides **field by field**, keeping the unset field from the server level |
        | hint returned by the handler on the result                              | beats both                                                                  |

        **`ttlMs: 0` means do not cache**, not no expiry. The client SDK is explicit that a
        `resources/read` result whose resolved TTL is at most zero is not stored at all, so the SDK default
        really does throw the feature away.

        **A typo in a method key is invisible**, which decides how commit 4 tests this: assert the values
        on the wire, never on the configuration object.

        **`resources/list` is not static per build**, contrary to the grouping this section previously
        carried. `arranger_catalogue_fields` is a `ResourceTemplate` whose `list` callback calls
        `client.getServerIntrospection()`, and the callback was measured running on every `resources/list`,
        so the result enumerates whatever catalogues Arranger currently reports. It tracks Arranger's
        configuration exactly as `resources/read` does and takes the same values. The other four are
        genuinely build-static: tool and prompt descriptions are literals, with every live introspection
        call inside a handler rather than in a registration, and `server/discover` carries
        `SERVER_INSTRUCTIONS` plus capabilities.

        **The scope is split rather than `public` for both**, which is a change from what this section
        proposed. The fact that makes it cheap: **`private` does not mean "do not cache", it means "do not
        share"**. The client still caches, partitioned by principal, so the benefit we actually want, one
        agent re-reading catalogue fields repeatedly inside a session, survives intact. `public` would only
        add cross-principal sharing at a shared gateway, which is speculative value for a single-tenant
        unauthenticated deployment.

        Against that, the risk is concrete rather than hypothetical: catalogue introspection already
        carries `meta.authFiltered`, so Arranger has a per-caller-filtered mode today. We neither read it
        nor forward auth headers, so we see one fixed view; the day either changes, `public` on those two
        is a cross-tenant leak. The spec is explicit that `cacheScope` is not access control and must never
        be the thing keeping one tenant's data from another, so the version of this decision that needs
        revisiting when auth lands is the version worth avoiding. The four build-static methods can never
        be per-caller, being literals compiled into the process, so `public` there is unconditionally safe
        and stays safe.

        **On the numbers.** An hour for build-static is a horizon where being wrong is cheap: a client
        holding a stale tool list across a redeploy gets a clean error, and the client SDK has an
        evict-refetch-retry path for tool schema drift specifically. Serving per request means
        `listChanged` cannot reach anyone, so TTL expiry is the only correction mechanism, which argues
        against much longer. Development staleness is answered by the Inspector's `refresh`, not by
        shortening the production hint. A minute for the pair that tracks Arranger means a catalogue change
        is visible without restarting this server, while still collapsing the burst of reads one agent
        session makes.

        **Deferred, deliberately:** `arranger_sqon_schema` tracks Arranger's build rather than its
        catalogue configuration, so a longer per-resource `cacheHint` would fit it. It is one line and a
        real difference in volatility, but it adds a third ttl for a resource read once per session. Leave
        it out of commit 4.

- **`serverInfo.version`** is hardcoded `'0.0.0-dev'` in `server.ts` and now appears on **every**
  result. Note the release process pins `main` at that placeholder, so the fix is to read the field,
  not to hardcode a different string. **Settled 2026-09-05**, verified against Node 24 and `tsc`:

    ```ts
    import packageJson from '../package.json' with { type: 'json' };
    new McpServer({ name: 'arranger-mcp-server', version: packageJson.version }, { ... });
    ```

    - **`with`, never `assert`.** `assert { type: 'json' }` was removed in Node 22 and is a hard
      `SyntaxError` on 24. It nonetheless appears to work here, because `tsx` strips it before Node
      sees it, so it would pass `npm start` and `npm test` and fail the moment anything ran the file
      through Node directly.
    - **No tsconfig change.** `module: nodenext` implies `resolveJsonModule`, which `tsc --showConfig`
      confirms is already on, and the import is typed rather than `any`: assigning `packageJson.version`
      to a `number` fails with `TS2322`. An earlier note in this plan claiming the flag was needed was
      wrong.
    - **`../package.json`, not `../../`.** Resolved from `src/server.ts`, one level up is the app's own
      manifest; two would reach `apps/package.json`.
    - **Not `process.env.npm_package_version`**, which is populated only when the process is launched
      through an npm script and is `undefined` under Docker or a process manager.
    - The relative path assumes the app keeps running from source, which it does today (`start` is
      `tsx ./src/index.ts`, with no build step). A `dist/` would change the depth.

- **`server/discover`** is SDK-provided but MUST be implemented. Add a contract test that it reports
  our capabilities and instructions. `SERVER_INSTRUCTIONS` stops being an `initialize` field and
  becomes part of this result.
- **Deterministic `tools/list` ordering** is a SHOULD. Our registration order is fixed and the
  catalogue filter is process-wide rather than per-client, so we already comply; pin it with a test.
- **Optional, and now DECLINED rather than deferred.** Annotating `catalogueId` with `x-mcp-header`
  would let a gateway route on it without parsing bodies, but it is **not additive**, which this
  plan assumed it was. Measured 2026-09-05: once a property carries the annotation,
  `validateMcpParamHeaders` runs pre-dispatch and rejects any call whose body carries that property
  without the matching `Mcp-Param-*` header, with `-32020` and HTTP `400`. It is a requirement on
  callers, not a hint. Every client that does not mirror parameters into headers would break, in
  exchange for a routing capability no deployment currently wants. Revisit only alongside a gateway
  that needs it.

**The test harness already exists.** `src/server.test.ts`, added in commit 3, drives the real HTTP
endpoint with `fetch` and is what the `server/discover` contract test, the `tools/list` ordering test
and the cache-hint wire assertions all need. Reuse it rather than building a second one, and note
that a hand-driven modern call needs `Mcp-Protocol-Version`, `Mcp-Method` and `Mcp-Name` headers or
it is answered `-32020` before any handler runs.

**Done when:** `server/discover` reports our capabilities and instructions, `tools/list` order is
pinned, `serverInfo.version` comes from `package.json` rather than a literal, and the configured
cache hints appear on a cacheable result. Each pinned by a test in the unit suite.

### Commit 4 as built, 2026-09-05

Built and green: 340 unit tests (up from 331), 87 integration tests, nothing skipped. The settled
hint values, the manifest read and the two contract tests all landed as specified.

**The silent-typo hole closed at compile time rather than only in a test.** `CacheableResultMethod`
is not exported, but `ServerOptions` is, so typing the constant as
`NonNullable<ServerOptions['cacheHints']>` gets the closed key union anyway and excess-property
checking rejects a non-cacheable key: `'tools/call'` now fails with `TS2353` rather than being
accepted and ignored. The wire assertions stay, because the type proves the SDK accepted the hint
and not that a client receives it.

**The cache-hint test restates the six values rather than importing the constant.** Comparing the
wire against the same object that configures it would pass whatever the values drifted to. A
mutation check confirms the six fail when `cacheHints` is removed from the constructor.

**The version test is weaker than it reads, deliberately and with the limit written down.** `main`
pins the manifest at `0.0.0-dev`, so today it cannot distinguish a manifest read from a literal that
matches; the same mutation check saw it pass with the literal restored. It bites on a release build,
which is the case that matters, and it also asserts `serverInfo` is stamped on more than one result
type, which is the reason the version stopped being cosmetic.

**`capabilities.prompts` is advertised**, which an early probe suggested it might not be: the probe
had registered no prompt. Against the real surface `server/discover` reports tools, resources and
prompts.

---

## Phase C, commit 5: docs

- `README.md` states v1.x explicitly and says nothing about which revision it serves; it now needs
  both, plus the requirement that a consumer opt into modern negotiation. Its folder-structure block
  still lists `http/app.ts` and `utils/inMemoryEventStore.ts`, deleted in commit 1, and still omits
  everything added since: `http/server.ts`, `http/requestBody.ts`, and the test files beside them.
  Its `execute_query` row should state that a client which cannot elicit is refused (decision 8).
  **The environment-variable table is not commit 5's job**: commits 1 and 3 each update it as they
  introduce their variables, so by the time this commit runs it should already be current, and the
  work here is to check that rather than to write it.
- **Decision 7, SETTLED 2026-09-03:** a compatible Inspector exists, so unpin rather than drop.
  `@modelcontextprotocol/inspector@2.5.0` is current (`latest`; `v1-latest` is `1.0.2`) and is built
  on `@modelcontextprotocol/{client,server,core}@2.0.0`. Move the `inspect` script in
  `apps/mcp-server/package.json` from `@modelcontextprotocol/inspector@1` to `@2`, and add
  `"protocolEra": "modern"` to the server entry in `mcp-inspector.json`: the Inspector maps that
  setting through `eraToVersionNegotiation` and, like the client library, defaults it to
  `{ mode: "legacy" }`, so without it the Inspector connects 2025-era and decision 3's endpoint
  refuses it.
- `CHANGELOG.md`: **2025-era clients are no longer served at all** (the headline, decision 3), the
  transport change, the confirmation flow becoming two requests, `execute_query` refusing clients
  that cannot elicit (decision 8), the approved query becoming integrity-bound with the optional
  `MCP_REQUEST_STATE_SECRET` behind it (decision 5), the new required `MCP_ALLOWED_HOSTS` (with its
  startup fail-fast) and the `403`-on-any-non-localhost-`Host` fix are all operator-facing. Say plainly that any
  consumer must opt into modern negotiation, since no SDK client does so by default.
- `.dev/docs/mcp-platform-testing.md`: see below.

**Done when:** nothing in `apps/mcp-server` still describes the v1 SDK or the 2025 era, the
folder-structure block matches the tree, `npm run mcp-server:inspect` connects, and `CHANGELOG.md`
names every operator-facing change from commits 1 to 4.

### Commit 5 as built, 2026-09-05

**Decision 7 re-verified against the shipped Inspector 2.5.0** rather than taken on the earlier
reading: `protocolEra` is read off the per-server `mcpServers` entry, `"modern"` maps to
`{ mode: { pin: "2026-07-28" } }`, and the source comments that an absent era "defaults to legacy".
So the setting is required, as decision 7 said. The `inspect` script was already on `@2` from
commit 1, leaving only the config key.

**The folder block names sources only**, with one line saying tests are co-located, rather than
listing a dozen `*.test.ts` entries as this section's wording implied. Enumerating them would have
doubled the block to restate a convention.

**`npm run mcp-server:inspect` connects**, confirmed by hand against a live Arranger on 2026-09-05.
It launches an interactive browser UI, so this is the one done-when condition no test covers.

**`.dev/docs/mcp-platform-testing.md` was deliberately not touched**, per the knock-on section below:
it is owned elsewhere, and its five amendments belong to that owner rather than to a unilateral edit
from this commit. That handoff is the only outstanding item in this plan.

---

## Knock-on: the MCP platform testing plan

Three of its pinned dimensions use vocabulary the revision removes. Hand these to that document's
owner rather than editing it unilaterally.

- **The surface hash** is defined as the `initialize` instructions plus the serialized lists.
  `initialize` is gone; `server/discover` carries instructions, capabilities, and supported versions
  in one place, and is a better hash source than what the plan describes.
- **Declared capabilities are no longer a session property.** They arrive per request, so the harness
  pins a per-request envelope and can legitimately vary it call by call.
- **L1's elicitation round trip** becomes a two-request exchange with an opaque state token between.
  Both halves are plain request/response, which makes it a better L1 test, and the assertion shape
  changes. Asserted once, not twice: decision 3 leaves one era, and the legacy shim was never
  reachable from a stateless endpoint anyway.
- **Era pinning is now a harness precondition.** Every SDK client defaults to 2025-era negotiation,
  so the harness must pin `2026-07-28` explicitly or it will measure a server that refuses it.
- **Cache hints are a new L1 surface**, since `ttlMs` and `cacheScope` are part of what we publish.

---

## What the revision changes, in full

Nine breaking changes; five land on our code.

| Change                                                                                    | Kind       | Hits                                         | Response                                              |
| ----------------------------------------------------------------------------------------- | ---------- | -------------------------------------------- | ----------------------------------------------------- |
| Protocol sessions and `Mcp-Session-Id` removed. No GET stream, DELETE, or `Last-Event-ID` | gone       | `http/app.ts`, `utils/inMemoryEventStore.ts` | both deleted                                          |
| Server-initiated requests removed; elicitation rides MRTR                                 | gone       | `mcp/executeQueryTool.ts`                    | phase B                                               |
| `initialize` / `notifications/initialized` removed; every request carries `_meta`         | shift      | `server.ts`, `mcp/instructions.ts`           | SDK-handled                                           |
| `server/discover` MUST be implemented                                                     | new        |                                              | SDK-provided; add a contract test                     |
| `ttlMs` / `cacheScope` required on cacheable results                                      | new        | `server.ts`                                  | decision 6                                            |
| All results carry `resultType`                                                            | shift      |                                              | SDK-handled at the codec                              |
| `Mcp-Method` / `Mcp-Name` headers required, `-32020` on mismatch                          | new        |                                              | SDK-handled                                           |
| `resources/subscribe` and GET stream become `subscriptions/listen`                        | shift      |                                              | free: we advertise no subscriptions                   |
| `ping`, `logging/setLevel`, `notifications/roots/list_changed` removed                    | gone       |                                              | unused; Pino already writes to process streams        |
| Resource-not-found moves `-32002` to `-32602`                                             | shift      | `http/app.ts`                                | SDK-handled; our `-32000` goes with the sessions code |
| List results must not vary per connection; `tools/list` SHOULD be ordered                 | already ok | `mcp/tools.ts`                               | pin with a test                                       |

**Not a concern:** the `Task` / `TaskStatus` / `ListTasks` exports in `server@2` are marked
`@deprecated 2025-11-25 wire vocabulary with no SDK runtime; kept importable for interoperability
only`. They are not new work.

---

## Decisions, collected

| #   | Decision                                                         | Blocks               | Status                                                                                                                                    |
| --- | ---------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | How the handler reaches Express, or whether Express stays at all | commit 1, everything | **settled 2026-09-03: Express dropped, `toNodeHandler` on `node:http`**                                                                   |
| 2   | Which Express major, if it stays                                 | commit 1             | **moot, closed by decision 1**                                                                                                            |
| 3   | Whether to serve 2025-era clients at all                         | commit 1, commit 2   | **settled 2026-09-03: `legacy: 'reject'`, one revision only**                                                                             |
| 4   | Re-entry budget and its exhaustion message                       | commit 2             | **moot, closed by decision 3**                                                                                                            |
| 5   | What goes into `requestState`                                    | commit 3             | **settled 2026-09-04: `{ digest }` of the built query, bind on method plus principal, per-process key by default**                        |
| 6   | Cache hint values and scopes                                     | commit 4             | **settled 2026-09-05: one hour and `public` for the four build-static methods, one minute and `private` for the two that track Arranger** |
| 7   | Inspector pin, if no compatible release exists                   | commit 5             | **settled 2026-09-03: unpin to `@2`, set `protocolEra: "modern"`**                                                                        |
| 8   | `execute_query` when a modern client cannot elicit               | commit 2             | **settled 2026-09-03: refuse the call**                                                                                                   |

Every commit is built and every decision is settled.

Separately from the decisions above, commit 1's review left three judgment calls that are accepted
but revisitable rather than settled: the startup fail-fast being stricter than the SDK, the body-cap
default preserving `100kb` rather than being measured, and whether `MCP_ALLOWED_ORIGINS` earns its
place. They are recorded in the as-built section, not here, because they are not gates on anything.

Decision 3 grew in scope while being settled, from "sign off on lost resumability" to "serve one
revision only". Whoever owns the sign-off should be told it changed, and why: the legacy path could
not have carried confirm-before-execute regardless, so the choice was never between full and degraded
legacy support.

---

## Provenance

Package facts, API names, option shapes, and the cacheable-method list were read on 2026-09-03 from
the shipped `.d.mts` declarations of `@modelcontextprotocol/server@2.0.0` and
`@modelcontextprotocol/express@2.0.0`, installed into a scratch project. Revision semantics come from
the "Crossing the Era Boundary" spec review, with its two errors corrected above: the Express bridge
does not live in the Express adapter, and Tasks are not new work.

Decision 1 was settled the same day against additional evidence, all reproducible:

- `@modelcontextprotocol/node@2.0.0` and `@modelcontextprotocol/client@2.0.0` added to the same
  scratch project, and their `dist/index.d.mts` and `dist/index.mjs` read directly. `toNodeHandler`
  does not call `getRequestListener`; the `@hono/node-server` import is module-level and its main
  entry does not import `hono`.
- `npm ls hono` and `npm ls express --workspaces` in this repo, showing `hono@4.12.23` and
  `@hono/node-server@1.19.14` already present under `@modelcontextprotocol/sdk@1.29.0`.
- Four clean-room installs (`sdk@1.29.0`; `server`+`node`; `server`+`express`+express 5; `server`
  alone) for the package-count and size table.
- The `Host` header behaviour probed against the installed v1 SDK with raw `node:http` requests.
  Note that `fetch` silently drops a `Host` header, so a fetch-based probe reports a false pass.
- v1's `dist/esm/server/auth/` compared against v2's exports, showing `mcpAuthRouter`,
  `OAuthServerProvider` and the `authorize`/`token`/`register`/`revoke` handlers are gone in v2.

Two later rounds of evidence, both by probe against a running server rather than by reading
declarations, after the declarations proved unreliable:

- **2026-09-04, commit 2.** A tool dumping `ctx.mcpReq` across both rounds, which is how the envelope
  correction was found: the reserved `io.modelcontextprotocol/*` keys arrive verbatim rather than
  lifted to friendly names. The same probe confirmed the handler re-runs from the top on re-entry,
  and that a client declaring no `elicitation` makes the SDK itself refuse an `inputRequired` return.
- **2026-09-04, decision 5.** `createRequestStateCodec` exercised directly for every failure mode
  (`mac`, `bind`, `expired`, `malformed`), plus end to end through `ServerOptions.requestState.verify`
  to confirm the seam decodes before the handler and `ctx.mcpReq.requestState()` yields the payload.
  The wire value was base64url-decoded to confirm the payload is signed but readable.

Decision 3 was settled the same day by experiment rather than by reading, which is why it overturned
the plan's own premise. Both scripts live in the scratch project and are worth re-running against any
future SDK release:

- A `createMcpHandler` server with one `inputRequired(...)` tool, served at `legacy: 'stateless'` and
  again at `legacy: 'reject'`, probed by two `@modelcontextprotocol/client@2` instances: one at its
  default negotiation, one at `{ pin: '2026-07-28' }`. This produced the refusal message and the
  `-32022` payload quoted in decision 3.
- The same server with a plain tool, a resource and a prompt, probed both ways, which produced the
  works/does-not-work table. `GET` and `DELETE` were probed directly for the 405s.
- `@modelcontextprotocol/inspector@2.5.0` unpacked and grepped, confirming it is built on the v2 SDK
  and that its `protocolEra` server setting maps through `eraToVersionNegotiation`, defaulting to
  `{ mode: "legacy" }`.
