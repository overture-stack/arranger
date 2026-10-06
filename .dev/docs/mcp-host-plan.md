# MCP Host: Plan

**Status:** draft for review, 2026-10-05. Nothing here is implemented.

**Goal:** a TypeScript stack that connects to MCP servers, runs a model through a tool-calling loop, and puts every confirmation a server asks for in front of a person, or, in an evaluation, a scripted policy. Three consumers share it:

- a terminal chat in this repository;
- the evaluation harness in [MCP platform testing](mcp-platform-testing.md);
- a notebook-style research UI, in its own repository.

"Host" is used in the MCP specification's sense: the application that owns the model and holds one MCP client per connected server.

**SDK baseline:** `@modelcontextprotocol/client`, `server` and `core` at 2.3.0 or later, raised together, and `@modelcontextprotocol/node` at its latest release (2.1.1). The repository installs 2.0.0 today. SDK claims below were read from the 2.3.1 source ([§4.3](#43-sdk-evidence)).

Background, including why existing chat hosts cannot drive `apps/mcp-server`: [atlas: MCP clients for a 2026-07-28-only server](atlas/mcp-client-landscape.md).

---

## 1. Overview

| Component                    | Package                                  | Lives in        | Job                                                                                          |
| ---------------------------- | ---------------------------------------- | --------------- | -------------------------------------------------------------------------------------------- |
| `modules/mcp-client`         | `@overture-stack/arranger-mcp-client`    | This repository | One connection to one MCP server, wrapping the SDK's `Client`. Published.                    |
| `modules/mcp-host-core`      | `@overture-stack/arranger-mcp-host-core` | This repository | The agent runtime: model provider, loop, tools across servers, approvals, events. Published. |
| `apps/mcp-cli`               | `@overture-stack/arranger-mcp-cli`       | This repository | `chat` in a terminal, and `eval`, the evaluation harness. Private.                           |
| `host-backend` (placeholder) | Decided in the UI repository             | UI repository   | Runs host-core on a server for the UI.                                                       |
| `host-ui` (placeholder)      | Decided in the UI repository             | UI repository   | React notebook. Talks only to `host-backend`, over WebSocket or SSE.                         |

```
  host-ui (browser)                          terminal
        │ WebSocket or SSE                       │
  host-backend (Node)                       apps/mcp-cli
        │                                  chat  │  eval
        └───────────────────┬────────────────────┘
                 modules/mcp-host-core ──── LLM provider ────▶ model server
                            │ holds one per server
                 modules/mcp-client
                            │ wraps
              SDK Client (@modelcontextprotocol/client)
                            │ Streamable HTTP
              MCP servers (apps/mcp-server, others)
```

**Rules for every component:**

1. **Dependencies point down only.** `mcp-client` depends on the SDK, `mcp-host-core` on `mcp-client` and the model provider's library, and the apps on `mcp-host-core`.
2. **No Arranger knowledge in the modules.** Neither module depends on any `@overture-stack/*` package outside the pair, or names an Arranger tool. Arranger knowledge (SQON equivalence, the fingerprint, the case set, scoring) lives in `mcp-cli eval`. This keeps the modules movable ([§5](#5-open-questions)).
3. **Node only.** Model credentials, including access to the team's Ollama server, must not reach a browser. `apps/mcp-server`'s Origin guard rejects unlisted browser origins on a routable bind. A user's MCP credential is held by the UI's server.
4. **Configuration arrives at the boundary.** The modules read no environment variables and no files, per `AGENTS.md`, including through a dependency ([§2.2](#22-mcp-host-core)). Each app has one config module that reads the environment.
5. **Server and model text is untrusted unless an operator marks the server trusted.**
    - Each configured server has a `trusted` flag, off by default.
    - Only a trusted server's `instructions` enter the system prompt, and only its prompts can start a conversation.
    - Everything else a server sends stays labelled as tool output.
    - Confirmation messages are passed on unmodified and rendered as text, never HTML.
    - Tool results are recorded verbatim, since a dataset record can contain text written to steer a model.
6. **Events are plain data.** No class instances or functions, so every event crosses a WebSocket unchanged.

---

## 2. Components

### 2.1 MCP client

`modules/mcp-client`. A host creates one instance per server.

| Concern              | What `mcp-client` does                                                                                                                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transport            | Streamable HTTP only.                                                                                                                                                                                                                                                       |
| Protocol revision    | `{ pin: '2026-07-28' }` only. The SDK's default, `'legacy'`, is refused by `apps/mcp-server`, so it is never passed through. `'auto'` arrives in Phase 5 if the UI needs it, with a test against a 2025-era server.                                                         |
| Auth                 | Static headers, or an SDK `AuthProvider`: `token()` before every request, and on a 401 `onUnauthorized()` and one retry. OAuth providers pass through.                                                                                                                      |
| Surface snapshot     | On connect and at the start of each run: the `server/discover` result (versions, capabilities, instructions) and the tool, resource, resource template and prompt lists, read with `cacheMode: 'refresh'`. The server's name and version are recorded beside it, not in it. |
| Surface hash         | SHA-256 over the canonicalized snapshot (rule below). Exported as a pure function, so L1 (the harness's contract tests in `integration-tests/mcp-server`) can hash a raw SDK client's responses.                                                                            |
| Change notifications | Off by default. A server's configuration can opt in.                                                                                                                                                                                                                        |
| Capabilities         | `elicitation: { form: {} }`, only when the host supplies an input resolver. Never `sampling` or `roots`, which `2026-07-28` deprecates and no Arranger tool uses.                                                                                                           |
| Requests             | `tools/call`, `prompts/get` and `resources/read` go through the confirmation loop below. List requests pass straight through.                                                                                                                                               |
| Cancellation         | Each call takes an `AbortSignal`; the SDK sends `notifications/cancelled`.                                                                                                                                                                                                  |
| Timeouts             | The SDK's timeout covers each request leg. Waiting for a person happens between legs, so a separate per-question timeout answers `cancel` when it expires.                                                                                                                  |

**Hash canonicalization.** Results carry fields that are not surface: `_meta` (which SHOULD include `io.modelcontextprotocol/serverInfo`, the server's name and version), `ttlMs`, `cacheScope` and `nextCursor`. The hash strips them, sorts object keys, and keeps list order. List order is part of what the model sees, and keeping it lets `surfaceStability` catch nondeterministic ordering.

**Why re-reads bypass the cache.** The SDK client caches list results by default, and `apps/mcp-server` marks its lists fresh for an hour. Without `'refresh'`, a long conversation, a shared cache store, or a reconnect through `prior` would keep a pre-redeploy surface and hash. Nothing re-reads during a run, so the cache would save little.

**Why change notifications are off.** On `2026-07-28`, the SDK receives list changes only over a `subscriptions/listen` stream, which it holds open for the life of the client once change handlers are configured. With one client per conversation per server, that is one open stream per conversation. `apps/mcp-server`'s lists never change. `chat` may opt in for servers whose lists do; `host-backend` should not.

**No stdio.** Every target server speaks HTTP, and a host-backend must never spawn a process named in user configuration. If `chat` later needs stdio, it arrives as an opt-in `host-backend` does not expose.

**One user per instance.** An instance holds one user's credential and is never shared. A response-cache store shared between instances must set `cachePartition` to the user's identity. Reconnecting is cheap: `connect(transport, { prior })` reuses a saved `server/discover` result for the same user.

#### The confirmation loop

On `2026-07-28`, a server that needs a confirmation answers with an `input_required` result instead of a final one. `mcp-client` sets `inputRequired: { autoFulfill: false }`, which applies to the whole SDK client, and drives the rounds itself:

1. Send the request with `client.request()` and `allowInputRequired: true`.
2. A complete result ends the loop.
3. Pass each `elicitation/create` entry in `inputRequests` to the host's resolver. Any other method fails the call.
4. Resend a round that carries `requestState` but no questions after 250 ms, as the SDK does.
5. Retry with the `inputResponses` and the `requestState` echoed byte for byte.
6. Stop after `maxRounds` (10, as in the SDK). Rounds without questions count.

```ts
type InputResolver = (request: {
	questionId: string; // `${callId}/${round}/${key}`, unique within a run
	callId: string; // the host's id for the tool call, prompt or resource read
	round: number;
	key: string; // the key in inputRequests
	message: string; // untrusted text from the server
	requestedSchema: unknown;
	signal: AbortSignal;
}) => Promise<ElicitResult>;
```

**Why manual mode:** it makes `requestState` visible, so the transcript records it and a later version can restore a pending confirmation ([§5](#5-open-questions), question 3), and it turns each round into an event. Routing a question to its call does not need it: each client has one call in flight.

**Why `request()`, not `callTool()`.** `execute_query`, the tool that asks for confirmation, declares an `outputSchema`. With `tools/list` cached, `callTool()` checks the reply's `structuredContent` against it, and an `input_required` reply has none, so it fails. That is read from source, not run; spike S2 confirms it. `request()` skips two things `callTool()` does:

- output-schema validation, which `mcp-client` does itself on the final result;
- `Mcp-Param-*` header mirroring, which no Arranger tool needs and the first release omits.

**On a 2025-era connection** (once `'auto'` ships), questions arrive as real `elicitation/create` requests. One registered handler routes each to the call in flight. Such a question is a live request, so it can never be saved with a conversation.

#### Outcomes

Every call resolves with one outcome and never throws. Each outcome carries wire time and waiting time separately.

| Outcome                | Meaning                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `result`               | The tool ran. Includes `isError: true`.                                             |
| `output_invalid`       | The tool ran, but its `structuredContent` failed the tool's `outputSchema`.         |
| `rejected`             | A JSON-RPC error, with its code, message and data.                                  |
| `input_state_rejected` | The server refused the echoed `requestState`. Carries how long the question waited. |
| `rounds_exceeded`      | Still asking after `maxRounds`.                                                     |
| `cancelled`            | The caller's signal aborted the call.                                               |
| `transport_error`      | A request leg got no answer: network, HTTP status, or authentication.               |

**Not "expired".** The server refuses an expired, forged or wrongly bound `requestState` with the same `-32602` error, and also refuses every earlier state after a restart without `MCP_REQUEST_STATE_SECRET`. The client cannot know which. The UI can say "probably expired" when the wait exceeded the server's window, 600 seconds for `apps/mcp-server`.

**Not in `mcp-client`:** models, tool-name namespacing, approvals, event formatting, retries, anything Arranger-specific.

### 2.2 MCP host core

`modules/mcp-host-core`. One instance runs one conversation, holding one `mcp-client` per configured server.

#### LLM provider interface

One method, `generate(request, signal)`, which streams deltas and ends with a final response.

- **Request:** model, system prompt, messages, tools; temperature, top-p, seed, maximum output tokens; `responseFormat`, a JSON Schema the output must match (for the judge); and `extra`, engine-specific fields such as top-k, passed through. All of it is recorded in `model_request`.
- **Final response:** text; well-formed tool calls; any malformed tool call with its raw text; exact token usage as the serving stack reported it; stop reason, reported model id, duration.

**Start from the SDK's `examples/cli-client`.** It has a provider seam, OpenAI, Anthropic, Gemini and scripted providers, and an agent loop. Its seam lacks exact usage, malformed-call text and streaming, and its OpenAI provider runs an unparseable call with `{}` as its arguments. Adapted code keeps the SDK's licence notices.

**One provider first:** OpenAI-compatible Chat Completions through the `openai` package, with a configurable base URL, covering Ollama, vLLM, LM Studio and hosted OpenAI. A scripted provider serves the tests. A second provider comes only when the UI needs one ([§5](#5-open-questions), question 2).

**The `openai` package falls back to environment variables** for options it is not given (`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_ORG_ID`, `OPENAI_PROJECT_ID`, `OPENAI_LOG`), per its documentation; confirm against the installed version. In `host-backend`, a missing base URL would send conversations wherever the environment points. The provider therefore requires the key and base URL, passes the rest explicitly, and has a test that sets those variables and asserts they are ignored.

`eval` does not stream. If spike S3 finds Ollama reports no usage at the end of a stream, streamed runs in `chat` and the UI report usage as unknown.

#### Agent loop

A **turn** is one `generate()` call. A run:

1. Sends the conversation and tools to the model.
2. Classifies the reply as text, well-formed tool calls, or a malformed tool call.
3. For each tool call in order: applies the approval policy, calls the tool, and passes any confirmation to the consumer.
4. Appends one tool message per tool call.
5. Repeats until the model answers in text, a limit is reached, or the run is cancelled.

**Every tool call gets a tool message**, or the conversation cannot continue: OpenAI-style APIs reject an assistant message whose tool calls lack replies. Host-core writes one before a run ends or its state is saved, with fixed wording so transcripts compare:

| What happened                                  | Tool message (an error unless noted)                          |
| ---------------------------------------------- | ------------------------------------------------------------- |
| `result`                                       | The content; an error only if `isError`                       |
| `output_invalid`                               | The result did not match the tool's declared output           |
| `rejected`                                     | The server rejected the call, with its message                |
| `input_state_rejected`                         | The confirmation was no longer accepted; the call did not run |
| `rounds_exceeded`                              | The server kept asking for input; the call was abandoned      |
| `cancelled`                                    | The user cancelled the call                                   |
| `transport_error`                              | The server could not be reached; the outcome is unknown       |
| Approval denied                                | The user declined the call                                    |
| Malformed call (counts against the call limit) | The call could not be parsed                                  |
| Not run, after a limit or cancellation         | The run stopped before this call                              |
| Restored while waiting on a confirmation       | The confirmation was abandoned; the call did not run          |

**Tool calls run one at a time**, so transcript order is execution order and each client has one call in flight. No Arranger tool gains from parallel calls.

**One run at a time.** Host-core refuses to start a run while one is active in the same conversation, such as from a second browser tab. One call in flight per client, and who may answer a question, both depend on it.

**Limits** on turns, tool calls and wall-clock time end the run; `done` names which. **Cancellation** is one `AbortSignal` per run.

**Model errors.** An HTTP error, timeout or refusal from the model server ends the run with a `model_error` event, without retrying. Every earlier tool call already has its message, so the conversation stays valid. `chat` and the UI show the error and let the user retry. `eval` voids the run, as it does for a parse-failure spike, since the failure belongs to the serving stack.

**Tool result size:** an optional cap on characters sent to the model, with the cut noted in the message and the full result kept in the event. `chat` sets 50,000. `eval` sets none, so scores reflect the server's output rather than a host's truncation, and records the setting in the manifest.

**Starting from a prompt:** a run can start from a trusted server's prompt, seeding the conversation with its messages and roles. `eval` needs this for the `query_arranger` entrypoint. If the prompt cannot be fetched, the run ends before any model call, with `done` naming the failure.

#### Tool registry

- **Names:** `mcp__<server>__<tool>`, as in the SDK's reference host, reduced to `^[a-zA-Z0-9_-]{1,64}$` for OpenAI-style APIs. MCP tool names may contain `.` and run to 128 characters, so both parts are reduced, and an over-long name is shortened with a deterministic hash suffix. The longest Arranger name is 35 characters.
- **Routing** reads the registry's map, never the string.
- **Collisions** are checked on every rebuild. One at the start of a run fails it; one found later leaves both tools out and is reported in `tools_changed`.
- **Schemas:** MCP `inputSchema` is JSON Schema and passes through. Spike S1 checks what the serving stack rejects.
- **Rebuilt** at the start of each run, and between turns for servers that opt in to change notifications.
- **The model-facing surface**, the tool definitions and labelled instructions in the provider's request format (OpenAI-style for the first provider), comes from an exported pure function, so `eval` and L1 can tokenize it. The serving stack's chat template renders it further, so its token count is a stable proxy for the real cost, not the exact figure.

#### Approval policy

|                      | Pre-call approval                                             | Server confirmation                                      |
| -------------------- | ------------------------------------------------------------- | -------------------------------------------------------- |
| Raised by            | Host-core, before calling a tool                              | The MCP server, inside a call (`input_required`)         |
| Answered by          | A consumer-supplied policy: `allow`, `deny` or `ask` per tool | The consumer only: a person, or `eval`'s scripted policy |
| Without the consumer | No run starts; the policy is required                         | Never asked: `elicitation` is not declared               |
| Events               | `approval_required`, `approval_answered`                      | `input_required`, `input_answered`                       |

The policy sees the run's earlier tool calls, so a consumer can require approval for a call that follows another server's output.

**Invariants:** host-core never answers a server confirmation itself and ships no "approve everything" resolver. The model never sees the question, only the tool message.

**Defaults:** `chat` allows every call, and `--confirm-tools` asks each time. `eval` allows every call; confirmations still follow the case's policy. The UI decides its own.

#### Events

Each event carries a run id, sequence number and timestamp.

| Event                                    | Carries                                                                                    | Required by               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------- |
| `run_started`                            | Model, limits, client name and version; each server's identity, surface hash, capabilities | `eval` (manifest), UI     |
| `tools_changed`                          | Changed servers, new hashes, tools left out and why                                        | All                       |
| `model_request`                          | The provider request except the messages; the message count                                | `eval`                    |
| `token`                                  | Streamed text                                                                              | `chat`, UI                |
| `model_response`                         | Text or tool calls, exact usage, stop reason, duration                                     | All                       |
| `malformed_tool_call`                    | The raw output                                                                             | `eval` (`parseFailures`)  |
| `model_error`                            | The model server's error: HTTP status, timeout or refusal, with its body                   | All; `eval` voids the run |
| `approval_required`, `approval_answered` | The tool call, the decision                                                                | `chat`, UI                |
| `tool_call`                              | Call id, server, tool, arguments                                                           | All                       |
| `input_required`                         | Question id, call id, round, key, message, requested schema                                | All                       |
| `input_answered`                         | Question id, the answer, how long it took                                                  | `eval`, UI                |
| `input_state_rejected`                   | Call id, server, how long the question waited                                              | UI, `eval`                |
| `tool_result`                            | Call id, outcome, `isError`, content, structured content, wire time, waiting time          | All                       |
| `done`                                   | Why the run ended, and totals                                                              | All                       |

**Answers come back by id** through `respond(id, answer)`, for approvals and confirmations alike, whether from a terminal, a script or a WebSocket. It is idempotent and returns `accepted`, `unknown`, `already_answered` or `timed_out`. `pending()` lists what is still open, for a UI that reconnects. Approvals and confirmations each take an optional timeout: an approval that times out counts as denied, and a confirmation is answered `cancel`.

#### Conversation state

A model-neutral, serializable message history that a consumer saves and hands back. A saved notebook is its state plus its events. **A pending confirmation is not restored in this version:** the call gets the "abandoned" tool message and the conversation continues ([§5](#5-open-questions), question 3).

**Not in host-core:** presentation, persistence, Arranger knowledge, reading configuration.

### 2.3 MCP CLI

`apps/mcp-cli`: `chat` and `eval` over one configuration.

**Not published.** Jenkins publishes only `modules/*` (`.dev/docs/release-process.md`). The app runs from a checkout, which `eval`'s local mode needs anyway, and this keeps the case set's dataset keys off npm.

**Shared:** one Zod-validated config module, the only code that reads `process.env`, documented in `.env.schema`; server configuration (URL, `trusted`, change notifications, and headers whose secrets come from the environment); provider construction; and a JSONL transcript writer.

#### `chat`

- A configurable system prompt, and no fixed reply cap (the SDK's reference host uses 1024 tokens).
- A flag to print tool results in full (the reference host shows 200 characters).
- Confirmation messages printed as plain text, with a form built from the requested schema and explicit `decline` and `cancel`.
- `/servers` and `/tools` show the surface. Ctrl-C cancels the run.
- `--transcript <path>` writes the events to a file. The file holds real dataset records and this repository's issues are public, so the command warns before writing, until [§5](#5-open-questions) question 6 is settled.

`chat` replaces the SDK's `examples/cli-client` in `apps/mcp-server/README.md` § Chatting with an LLM.

#### `eval`

The harness in [MCP platform testing](mcp-platform-testing.md), which owns the metrics, case format, fingerprint and manifest. `eval` owns its runner; `vitest-evals` is not used (that plan's §5.2).

| Subcommand                    | Does                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `eval run`                    | Fingerprints Arranger, runs the cases, writes JSONL records and the manifest |
| `eval judge <records>`        | Scores stored records with the judge, without re-running the loop            |
| `eval agreement`              | Checks the judge against the committed human grades                          |
| `eval compare <base> <cand>`  | Paired per-case differences with intervals                                   |
| `eval bootstrap-expectations` | Derives each case's expected outcome, with a diff for review                 |

**One phrasing is one new host-core instance**, with new `mcp-client` instances, running one run with greedy sampling and no streaming, the case's budget as limits, every call allowed, and the case's elicitation policy as the resolver: `accept` or `decline` at once, or no resolver for `not-advertised`. Concurrency is 1, and an intent's phrasings run in one loop so the aggregate metrics are computed there.

**On top of the events, `eval` adds:**

- a tokenizer client (the serving stack's endpoint, or a pinned local tokenizer) for the token metrics;
- a check of each turn's prompt tokens against the context window, which fails the run when reached;
- rejection classification: parse failures are `malformed_tool_call` events or calls written as prose; schema rejections start with the SDK's `Input validation error`; the rest are semantic;
- voiding a run that ends in `model_error`, rather than scoring it;
- the manifest fields host-core cannot know: run configuration, case set hash, fingerprint.

**The judge** is a separate provider instance on `JUDGE_MODEL`, called with a `responseFormat`, outside the agent loop.

**Arranger knowledge lives here:** SQON equivalence through `@overture-stack/sqon`, the fingerprint, the case set (loaded from a configured path) and the scorers. `apps/mcp-server` is marked trusted, so `query_arranger` can start a run.

**Local mode starts the built `apps/mcp-server` as a child process**, after the rebuild the harness plan requires. Importing the server's source, as `integration-tests/mcp-server` does, would pull it into `mcp-cli`'s own build.

**`eval` never runs from `npm test`.** L1 stays on the raw SDK client, so a bug in this stack cannot hide a server bug.

### 2.4 Host backend (placeholder)

In the UI repository. This plan requires that it:

- runs one host-core instance per conversation;
- gives each `mcp-client` the signed-in user's credential, never a shared service credential, which would make the MCP server a confused deputy ([MCP platform testing](mcp-platform-testing.md) §5.4.1);
- lets only that user answer the instance's approvals and confirmations, including in a shared notebook;
- keeps model credentials off the browser;
- streams events over WebSocket or SSE, takes answers as `respond` calls, and reads `pending()` after a reconnect;
- saves state and events per notebook;
- takes MCP servers from operator configuration only, never from user input, which would let users reach internal addresses;
- leaves change notifications off;
- decides through its approval policy whether a call that follows another server's output needs approval.

### 2.5 Host UI (placeholder)

In the UI repository. This plan requires that it renders events as notebook cells, renders server and tool text as text rather than HTML, shows each confirmation with its tool call and how long it has waited, says "probably expired" on `input_state_rejected`, and holds no credentials.

---

## 3. Phases

### Phase 0: spikes

Each can change the design, except S2, which confirms it.

- **S1: schema conversion.** Convert all five Arranger tools' input schemas, including `execute_query`'s unconstrained `sqon`, to Ollama's tool format. Confirm the team's models call them correctly. Check for `$ref`.
- **S2: `callTool()` against `request()`.** Confirm `callTool(..., { allowInputRequired: true })` fails on `execute_query`'s `input_required` reply with `tools/list` cached, and `request()` completes the round trip.
- **S3: streamed usage from Ollama.** Check whether `stream_options: { include_usage: true }` returns exact usage at the end of a stream on `/v1/chat/completions`. If not, streamed runs report usage as unknown.
- **S4: malformed tool calls.** Collect real examples from the team's models: malformed calls returned, calls written as prose, and any the serving stack refuses with an HTTP error (unverified for Ollama).
- **S5: a refused confirmation.** Restart a loopback `apps/mcp-server` without `MCP_REQUEST_STATE_SECRET` between question and answer, and record what the client surfaces. The source says `-32602` with `data.reason: 'invalid_request_state'`.

### Phase 1: MCP client

- **Raise `client`, `server` and `core` to 2.3.0 or later together**, since each pins `core` exactly, and `node` to 2.1.1. The server's upgrade lands as its own change in the next `rc`, with a changelog entry and passing server and integration tests, before any eval baseline exists.
- `modules/mcp-client` ([§2.1](#21-mcp-client)), tested against an in-process v2 server with a short-lived `requestState`: confirmation rounds including one with no questions, `input_required` on `prompts/get`, a refused state, `rounds_exceeded`, cancellation, `output_invalid`, a re-read that bypasses the cache, opting in to change notifications, and a hash unchanged by a version bump, cache fields or `_meta`.

### Phase 2: host core

`modules/mcp-host-core` ([§2.2](#22-mcp-host-core)) with the scripted and OpenAI-compatible providers. Tests cover the provider ignoring `OPENAI_*` variables, every row of the tool-message table, a `model_error`, refusing a second concurrent run, approval and confirmation timeouts, and restoring a conversation that was waiting on a confirmation.

### Phase 3: `chat`

`apps/mcp-cli` with its config and `chat`. The README section switches to it.

### Phase 4: `eval`

Phases 1 to 4 of [MCP platform testing](mcp-platform-testing.md), on host-core events. Its spikes R2 to R7 still apply, and R1 is the end-to-end run. Phases 3 and 4 can run in parallel.

### Phase 5: first release for the UI

Publish both modules under the `rc` dist-tag, with a short API stability note each. Add a second provider and `'auto'` negotiation if the UI needs them.

**Packaging:** the modules follow `modules/sqon`: dual ESM and CommonJS through `tsup`, `wireit` builds, `0.0.0-dev` on `main`, `rc` from `release-test`. `apps/mcp-cli` builds like `apps/mcp-server`. All three join the root `workspaces`.

---

## 4. Research and decisions

### 4.1 Decisions

Component-level decisions are stated with their reasons in [§2](#2-components). These span the plan:

| Decision                                     | Why                                                                                                                                                                                                   |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One shared stack for chat, harness and UI    | Separate implementations would drift.                                                                                                                                                                 |
| The two modules are published                | The UI's repository depends on them.                                                                                                                                                                  |
| A connection layer separate from the runtime | `mcp-client` knows nothing about models, so it can be tested and reused alone. The runtime is shared by the CLI and the UI's backend.                                                                 |
| `chat` and `eval` in one app                 | They share configuration, providers, servers and the transcript format. An evaluation is a chat with scripted answers and scoring.                                                                    |
| Start in this repository                     | Two of three consumers and the first test target are here, and the modules change fastest while those are built.                                                                                      |
| Own the loop rather than adopt a framework   | The Vercel AI SDK hides the exact usage and tool-call fields the harness reads. LangChain's MCP adapter re-runs a call's first round on resume ([research record](atlas/mcp-client-landscape.md) §3). |
| SDK 2.3.0 or later (`node` 2.1.1)            | 2.3.0 stops following redirects to other origins; 2.2.0 made list calls read every page.                                                                                                              |

### 4.2 What each consumer needs

| Need                                                  | Terminal chat                    | Eval harness                                     | Notebook UI (server side)                  | Owned by                      |
| ----------------------------------------------------- | -------------------------------- | ------------------------------------------------ | ------------------------------------------ | ----------------------------- |
| Connect to an MCP server over Streamable HTTP         | Yes                              | Yes, local or remote mode                        | Yes                                        | `mcp-client`                  |
| Several servers at once                               | Yes                              | No                                               | Yes                                        | `mcp-host-core`               |
| Pin the protocol revision, or negotiate               | Pin `2026-07-28`                 | Pin                                              | Negotiate, from Phase 5 if needed          | `mcp-client`                  |
| Auth per server                                       | Static header from configuration | Yes, once `MCP_API_KEY` lands                    | The signed-in user's credential            | `mcp-client`                  |
| Choose the model per conversation                     | Flag                             | Pinned per run                                   | User picks                                 | `mcp-host-core`               |
| Exact sampling parameters per request                 | Defaults                         | Greedy, seed, engine extras, recorded            | Defaults                                   | `mcp-host-core`               |
| Constrained output                                    | No                               | **Required** for the judge                       | No                                         | Provider                      |
| Exact token usage per model call                      | Display only                     | **Required**, it is a metric                     | Display, maybe quotas                      | Provider                      |
| Tokenizing text the model has not been sent           | No                               | **Required** for two token metrics               | No                                         | `eval`                        |
| Streamed model output                                 | Yes                              | No, and recorded as off                          | **Required**                               | Provider                      |
| Server instructions in the system prompt              | Trusted servers                  | Yes, and counted in the static surface           | Trusted servers                            | `mcp-host-core`               |
| Start a conversation from an MCP prompt               | Nice to have                     | **Required** for the `query_arranger` entrypoint | Nice to have                               | `mcp-client`, `mcp-host-core` |
| Pre-call tool approval                                | Optional flag                    | Allow everything                                 | User setting                               | `mcp-host-core`               |
| Answering a server confirmation                       | Terminal prompt                  | Scripted: accept, decline, not advertised        | Dialog, answered by the credential's owner | Consumer, through `respond`   |
| Ordered record of everything that happened            | Printed as it happens            | **Required**, it is the transcript               | **Required**, it becomes notebook cells    | `mcp-host-core` events        |
| Telling a malformed tool call from a server rejection | No                               | **Required** (`parseFailures`)                   | Useful for error display                   | Provider, `mcp-host-core`     |
| Server time apart from waiting time                   | No                               | **Required** (`serverLatency`)                   | Useful                                     | `mcp-client`                  |
| Limits on turns, tool calls and wall-clock time       | Yes                              | Yes, per case                                    | Yes                                        | `mcp-host-core`               |
| Cancellation                                          | Ctrl-C                           | Budget exceeded                                  | User stops a run                           | `mcp-host-core`, `mcp-client` |
| Save and restore a conversation                       | No                               | No                                               | **Required**, notebooks persist            | `mcp-host-core` state         |
| Re-score stored transcripts                           | No                               | **Required** (L3)                                | No                                         | `eval`                        |
| A snapshot of the server's surface                    | `/tools`                         | **Required**, it is hashed                       | Shown when connecting                      | `mcp-client`                  |

None of the "Required" cells conflict. The harness needs exact usage but no streaming, and the UI the reverse; spike S3 checks whether Ollama gives both at once.

### 4.3 SDK evidence

Read from the `@modelcontextprotocol/client` 2.3.1 source. Paths are in the SDK repository.

| Claim used above                                                                                                         | Where                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Version negotiation defaults to `'legacy'`; a pin fails on anything else                                                 | `packages/client/src/client/versionNegotiation.ts`                                                  |
| The automatic handler's context does not identify the call                                                               | `synthesizeInputRequestContext`, `packages/core-internal/src/shared/inputRequiredEngine.ts`         |
| `autoFulfill: false` applies to the whole client; rounds without questions wait 250 ms, max 10 rounds                    | `packages/client/src/client/client.ts`, `packages/core-internal/src/shared/inputRequiredDriver.ts`  |
| `callTool()` validates `structuredContent` against a cached `outputSchema`; `request()` does not, nor mirror headers     | `Client.callTool`, `packages/client/src/client/client.ts`                                           |
| A refused `requestState` gets `-32602`, `data.reason: 'invalid_request_state'`, whatever the cause                       | `packages/server/src/server/server.ts`                                                              |
| List changes arrive only over an auto-opened `subscriptions/listen` stream on `2026-07-28`                               | `packages/client/src/client/client.ts`; `McpServer` defaults in `packages/server/src/server/mcp.ts` |
| The client caches list results by default (`cacheMode: 'use'`); `'refresh'` bypasses it                                  | `packages/client/src/client/client.ts`                                                              |
| Results carry `_meta` (SHOULD include `io.modelcontextprotocol/serverInfo`); list results carry `ttlMs` and `cacheScope` | `packages/core-internal/src/types/spec.types.2026-07-28.ts`                                         |
| `@modelcontextprotocol/node` is at 2.1.1, with `server` as a caret peer dependency                                       | `packages/middleware/node/package.json`                                                             |
| `connect(transport, { prior })` reuses a saved `server/discover` result                                                  | `ConnectOptions`, `packages/client/src/client/client.ts`                                            |
| `AuthProvider`: `token()` per request, one retry after `onUnauthorized()`                                                | `packages/client/src/client/auth.ts`                                                                |
| Sampling, roots and logging deprecated as of `2026-07-28` (SEP-2577); elicitation is not                                 | `packages/core-internal/src/types/spec.types.2026-07-28.ts`                                         |
| Tool names may use `.` and run to 128 characters                                                                         | `packages/core-internal/src/shared/toolNameValidation.ts`                                           |
| 2.2.0 list pagination fix; 2.3.0 same-origin redirects                                                                   | `packages/client/CHANGELOG.md`                                                                      |
| `examples/cli-client` is private, and has no usage, streaming, malformed-call text or name-length handling               | `examples/cli-client`                                                                               |
| Licence: Apache-2.0 for new contributions, MIT for those not relicensed; no NOTICE file                                  | `LICENSE`                                                                                           |

---

## 5. Open questions

1. **The `arranger-` prefix on the modules.** They are general-purpose by rule 2, and the UI will depend on them by name. Moving them to another repository later would rename them for every consumer.
2. **Which models the UI offers at launch.** OpenAI-compatible endpoints only, which covers the team's Ollama, or hosted providers too? This decides whether Phase 5 needs a second provider.
3. **Whether a later version restores a run waiting on a confirmation**, such as after a browser is closed mid-question. Manual mode records the `requestState`, but restoring also needs the call's arguments, the round, the question and a way back into a run mid-call. The answer must arrive within the server's window, and it is impossible on a 2025-era connection.
4. **Whether the modules should leave this repository**, and what would trigger it.
5. **The modules' licence.** This repository is AGPL-3.0. A `host-backend` running AGPL modules as a network service must offer its source to the UI's users. That should be a deliberate choice before the UI depends on them.
6. **Transcript retention.** `chat` transcripts, `eval` records and saved notebooks all contain real dataset records. The harness plan leaves open whether they may be kept, and where; the question now covers all three. It must be settled before `eval` keeps records (Phase 4); until then `chat --transcript` warns before writing.

---

## 6. Documents this changes

**Already updated:**

- [MCP platform testing](mcp-platform-testing.md) builds the harness on this plan. If this plan changes in review, its §5 and §7 change too.
- [atlas: MCP clients for a 2026-07-28-only server](atlas/mcp-client-landscape.md) §5.
- `.dev/roadmap.md`: entries for this plan and the harness.
- `.dev/tech-debt.md`: confirmation state bound to the OAuth client rather than the user ([§2.4](#24-host-backend-placeholder)).

**When the work lands:** `CHANGELOG.md` for the SDK upgrade (Phase 1), `AGENTS.md` § Structure for the new workspaces, and `apps/mcp-server/README.md` § Chatting with an LLM (Phase 3).
