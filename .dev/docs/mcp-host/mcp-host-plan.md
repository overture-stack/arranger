# MCP Host: Plan

**Status:** plan approved 2026-10-07. Phase 0: spikes run on local Ollama ([results](phase0-results.md)); confirmation on the development team's shared server outstanding. Phase 1: done. Phase 2: can start; only how a conversation keeps servers apart waits on [§5](#5-open-questions) question 4. Since 2026-10-16, the CRE is a standalone Electron desktop app, with host-core in its main process ([§2.4](#24-cre-main-process)).

**Recommended, pending the team:** no release of the CRE claims support for controlled data until this plan's security-relevant items, including the open questions below, are settled and built. The CRE is a tool the person configures: they choose its MCP servers and its model, and whether the records they read may reach those is theirs to judge under their own agreements. An Overture deployment, an organization's running Overture platform, is one kind of server it may connect to, never a requirement. Usher, Overture's access enforcement system, sorts data into three tiers: open data anyone may read, registered data any signed-in person may read, and controlled data only people granted access to that dataset may read. For an Overture deployment holding controlled data, the gate is its operator's: it registers neither the CRE with its sign-in service nor an MCP server of its own until then, so the CRE reaches only its open data, anonymously, even where registered data sits alongside it. A deployment holding nothing controlled is unaffected.

**Goal:** a TypeScript stack that connects to MCP servers, runs a model through a tool-calling loop, and puts every confirmation in front of a person (or, for evaluations, a scripted policy).

Three consumers of one shared MCP Host Core:

1. a command line interface (CLI) terminal chat (TUI);
2. the evaluation harness in [MCP Platform Testing](../mcp-platform-testing.md);
3. the Conversational Research Environment (CRE), a notebook-style desktop app that researchers run on their own machines.

"Host" is used in the MCP specification's sense: the application that owns the model and holds one MCP client per connected server.

**SDK baseline:** `@modelcontextprotocol/client`, `server` and `core` at 2.3.0 or later, raised together (installed: 2.3.1), and `@modelcontextprotocol/node` at 2.1.1. SDK claims below were read from the 2.3.1 source ([§4.3](#43-sdk-evidence)).

Background, including why existing chat hosts cannot drive `apps/mcp-server`: [atlas: MCP clients for a 2026-07-28-only server](../atlas/mcp-client-landscape.md).

---

## 1. Overview

| Component               | Package                               | Lives in                      | Job                                                                                                                                                                                                                                                                                                                                   |
| ----------------------- | ------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modules/mcp-client`    | `@overture-stack/arranger-mcp-client` | This repository               | One connection to one MCP server, wrapping the SDK's `Client`. Published.                                                                                                                                                                                                                                                             |
| `modules/mcp-host-core` | `@overture-stack/mcp-host-core`       | This repository (temporarily) | The agent runtime: model provider, loop, tools across servers, approvals, events.                                                                                                                                                                                                                                                     |
| `apps/mcp-cli`          | `@overture-stack/mcp-cli`             | This repository (temporarily) | `chat` in a terminal, and `eval`, the evaluation harness. Private.                                                                                                                                                                                                                                                                    |
| `cre-main`              | Decided in the CRE repository         | CRE repository                | Electron's main process. Runs `mcp-host-core`, for the first release (above). It still makes the same outbound calls the CLI does, to MCP servers, the model endpoint, and the identity provider for sign-in.                                                                                                                         |
| `cre-renderer`          | Decided in the CRE repository         | CRE repository                | Electron's renderer process. Notebook-style display. Its own wiring to `cre-main` is Electron's IPC (`contextBridge`/`ipcRenderer`), not a network call. Hardened per [§2.5](#25-cre-renderer): context isolation, the sandbox, Node integration off, and a content security policy that permits no remote network access of its own. |

```
        cre-renderer                   terminal
              │                            │
              │ Electron IPC               │
              ▼                            ▼
          cre-main                   apps/mcp-cli
              │                            │
              │                       chat │ eval
              ▼                            ▼
              └──────────────┬─────────────┘
                             │
                             ▼
                   modules/mcp-host-core ◄──────► LLM provider ◄──────► model server
                             │
                             │ (holds one per server)
                             ▼
                    modules/mcp-client
                             │
                             │ (wraps)
                             ▼
         SDK Client (@modelcontextprotocol/client)
                             │
                             │ (Streamable HTTP)
                             ▼
               MCP servers (apps/mcp-server)
```

Diagrams of this design, from the system context to each request's flow: [MCP Host: Architecture](architecture.md). Why the CRE is an Electron desktop app, and what runs in each of its processes: [§2.4](#24-cre-main-process).

**Rules for every component:**

1. **Dependencies point down only.** `mcp-client` depends on the SDK, `mcp-host-core` on `mcp-client` and `eventsource-parser` ([Model Provider Analysis](model-provider-analysis.md)), and the apps on `mcp-host-core`.
2. **No Arranger knowledge in the modules.** Neither module depends on any `@overture-stack/*` package outside the pair, or names an Arranger tool. Arranger knowledge (SQON equivalence, the fingerprint, the case set, scoring) lives in `eval`. This keeps the modules movable.
3. **Node only.** Model credentials, including any key for a remote provider, must not reach the renderer process, which displays untrusted text. Whenever `apps/mcp-server` listens on a network address, its Origin guard refuses requests from web pages on sites it does not list, which still matters if a connection ever crosses a network rather than staying on the person's own machine. A user's MCP credential is held by the CRE's main process, never the renderer.
4. **Configuration arrives at the boundary.** The modules read no environment variables and no files, per `AGENTS.md`, including through a dependency ([§2.2](#22-mcp-host-core)). Each app has one config module that reads the environment.
5. **Server and model text is untrusted unless an operator marks the server trusted.**
    - Each configured server has a `trusted` flag, off by default. In the desktop app, the shipped configuration sets it; a server the user adds starts untrusted.
    - Only a trusted server's `instructions` enter the system prompt, and only its prompts can start a conversation.
    - Everything else a server sends stays labelled as tool output.
    - Confirmation messages are passed on unmodified and rendered as text, never HTML.
    - Tool results are recorded verbatim, since a dataset record can contain text written to steer a model.
6. **Events are plain data.** No class instances or functions, so every event serializes cleanly across Electron's IPC boundary and into a saved notebook unchanged.

---

## 2. Components

### 2.1 MCP Client

`modules/mcp-client`. A host creates one instance per server.

| Concern              | What `mcp-client` does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transport            | Streamable HTTP only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Protocol revision    | `{ pin: '2026-07-28' }` only. The SDK's default, `'legacy'`, is refused by `apps/mcp-server`, so it is never passed through. `'auto'` arrives in Phase 5 if the CRE needs it, with a test against a 2025-era server.                                                                                                                                                                                                                                                                                                                           |
| Auth                 | Static headers, or an SDK `AuthProvider`: `token()` before every request, and on a 401 `onUnauthorized()` and one retry. Refused over plain HTTP to anything but a loopback address, unless the caller opts in. The SDK's interactive OAuth flow is not exposed: a host supplies tokens through `token()`.                                                                                                                                                                                                                                     |
| Surface snapshot     | On connect and at the start of each run: the `server/discover` result (versions, capabilities, instructions), read through `client.discover()`, which is never cached, and the tool, resource, resource template and prompt lists, read with `cacheMode: 'refresh'`. A list the server does not advertise is recorded as empty. The server's name and version, from each `server/discover`, are recorded beside it, not in it. A list advertised after connect needs a new client, since the SDK checks capabilities as they stood at connect. |
| Surface hash         | SHA-256 over the canonicalized snapshot (rule below). The canonicalization and the hash are exported as pure functions, so L1 (the harness's contract tests in `integration-tests/mcp-server`) can hash a raw SDK client's responses and count their tokens.                                                                                                                                                                                                                                                                                   |
| Change notifications | Off by default. A server's configuration can opt in. `mcp-client` reports which list changed; host-core re-reads the surface between turns.                                                                                                                                                                                                                                                                                                                                                                                                    |
| Background errors    | Errors the SDK raises outside any call, such as a change-notification stream that failed to open, go to the host's `onError`.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Capabilities         | `elicitation: { form: {} }`, only when the host supplies an input resolver. Never `sampling` or `roots`, which `2026-07-28` deprecates and no Arranger tool uses.                                                                                                                                                                                                                                                                                                                                                                              |
| Requests             | `tools/call`, `prompts/get` and `resources/read` go through the confirmation loop below. List requests pass straight through.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Cancellation         | Each call takes an `AbortSignal`. Aborting closes the request's stream (`2026-07-28` HTTP sends no `notifications/cancelled`), and the server's handler sees the abort. The SDK reports an abort like a timeout, so `cancelled` comes from the caller's own signal.                                                                                                                                                                                                                                                                            |
| Timeouts             | The SDK's timeout covers each request leg. Waiting for a person, between legs, has no timer here: it ends when the resolver settles or the call is aborted. Host-core owns that timeout ([§2.2](#events)).                                                                                                                                                                                                                                                                                                                                     |

**Hash canonicalization.** The snapshot is built from named fields: `supportedVersions`, `capabilities` and `instructions` from `server/discover`, and each list's items. Result-level fields that are not surface never enter it: `_meta` (which SHOULD include `io.modelcontextprotocol/serverInfo`, the server's name and version), `ttlMs`, `cacheScope` and `nextCursor`. Items keep their own `_meta`, since hosts act on it, and stripping every `_meta` key would also delete an input-schema property of that name. The hash sorts object keys and keeps list order. List order is part of what the model sees, and keeping it lets `surfaceStability` catch nondeterministic ordering.

**Why re-reads bypass the cache.** The SDK client caches list results by default, and `apps/mcp-server` marks its lists fresh for an hour. Without `'refresh'`, a long conversation would keep a pre-redeploy surface and hash. Nothing re-reads during a run, so the cache would save little.

**Why change notifications are off.** On `2026-07-28`, the SDK receives list changes only over a `subscriptions/listen` stream, which it holds open for the life of the client once change handlers are configured. With one client per conversation per server, that is one open stream per conversation. `apps/mcp-server`'s lists never change. `chat` may opt in for servers whose lists do; the CRE's main process should not.

**No stdio.** Every target server speaks HTTP, and the CRE's main process must never spawn a process named in user configuration. If `chat` later needs stdio, it arrives as an opt-in the CRE's main process does not expose.

**One user per instance, one credential per server.** An instance holds one user's credential for its one server, and is never shared; a credential for one server never reaches another, so an Overture token never reaches a third party ([MCP host: connection authentication](../arranger-auth/mcp-host-connections.md) §4).

**No `connect(transport, { prior })`.** It skips `server/discover`, which the snapshot on connect reads anyway, since a saved result can predate a redeploy.

#### The Confirmation Loop

On `2026-07-28`, a server that needs a confirmation answers with an `input_required` result instead of a final one. `mcp-client` sets `inputRequired: { autoFulfill: false }`, which applies to the whole SDK client, and drives the rounds itself:

1. Send the request with `client.request()` and `allowInputRequired: true`.
2. A complete result ends the loop.
3. Report the round to the call's `onRound` observer, including a round without questions.
4. Pass each form-mode `elicitation/create` entry to the host's resolver, a round's questions together. Any other request fails the call as `input_failed` before anything is asked. A compliant server never sends one: it refuses a request the client did not declare, with `-32021`.
5. Resend a round that carries `requestState` but no questions after 250 ms, as the SDK does.
6. Retry with this round's `inputResponses` and the `requestState` echoed byte for byte, even an empty one.
7. Stop after `maxRounds` retries (10, as in the SDK). Rounds without questions count.

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

**Why manual mode:** it makes `requestState` visible, so the transcript records it, and it turns each round into an event, through `onRound`. That runs before any question is asked, so host-core holds the pending state while it waits; if it throws, the call is `input_failed`. A later version could use that same visibility to restore a pending confirmation; this version does not ([Conversation State](#conversation-state)). Routing a question to its call does not need manual mode: each client has one call in flight.

**Why `request()`, not `callTool()`.** `execute_query`, the tool that asks for confirmation, declares an `outputSchema`. With `tools/list` cached, `callTool()` checks the reply's `structuredContent` against it, and an `input_required` reply has none, so it throws `-32600`; without the cache, it returns the reply mistyped as a `CallToolResult`. S2 confirmed both ([results](phase0-results.md#s2-calltool-against-request)). `request()` skips two things `callTool()` does:

- output-schema validation, which `mcp-client` does itself on the final result, compiling each snapshot's schemas with a fresh Ajv instance so that none accumulate. A schema over 64 KiB or 32 levels deep is not compiled, since it comes from the server. Unlike `callTool()`, which refuses before sending, a schema that cannot be compiled still lets the tool run, and its result is `output_invalid`;
- `Mcp-Param-*` header mirroring, which no Arranger tool needs and the first release omits.

**On a 2025-era connection** (once `'auto'` ships), questions arrive as real `elicitation/create` requests. One registered handler routes each to the call in flight. Such a question is a live request, so it can never be saved with a conversation.

#### Outcomes

Every call resolves with one outcome and never throws. Each carries wire time, waiting time (in the resolver) and the round count.

| Outcome                | Meaning                                                                                                                                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `result`               | The tool ran. Includes `isError: true`.                                                                                                                                                                                                                       |
| `output_invalid`       | The tool ran, but its `structuredContent` failed the tool's `outputSchema`, or the schema does not compile.                                                                                                                                                   |
| `rejected`             | A JSON-RPC error, with its code, message and data.                                                                                                                                                                                                            |
| `input_state_rejected` | The server refused the echoed `requestState`. Carries how long the question waited.                                                                                                                                                                           |
| `input_failed`         | The client could not answer, so the call did not run: `unsupported_request` or `resolver_error`.                                                                                                                                                              |
| `rounds_exceeded`      | Still asking after `maxRounds`.                                                                                                                                                                                                                               |
| `cancelled`            | The caller's signal aborted the call, including while the resolver waited.                                                                                                                                                                                    |
| `transport_error`      | A request leg got no usable answer. `kind` names the cause: `timeout`, `http`, `unauthorized`, `closed`, `network`, `invalid_result` (a reply the SDK could not decode), `not_connected`, or `unknown`, which includes an unexpected error inside the client. |

**An undecodable reply is a `transport_error`**, not `rejected`: whether the tool ran is unknown.

**Not "expired".** The server refuses an expired, forged or wrongly bound `requestState` with the same `-32602` error, and also refuses every earlier state after a restart without `MCP_REQUEST_STATE_SECRET`. The client cannot know which. The UI can say "probably expired" when the wait exceeded the server's window, 600 seconds for `apps/mcp-server`.

**Not in `mcp-client`:** models, tool-name namespacing, approvals, event formatting, retries, anything Arranger-specific.

### 2.2 MCP Host Core

`modules/mcp-host-core`. One instance runs one conversation, holding one `mcp-client` per configured server.

#### LLM Provider Interface

One method, `generate(request, signal)`, which streams deltas and ends with a final response.

- **Request:** model, system prompt, messages, tools; temperature, top-p, seed, maximum output tokens; `responseFormat`, a JSON Schema the output must match (for the judge); and `extra`, engine-specific fields such as top-k, passed through. All of it is recorded in `model_request`.
- **Final response:** text; reasoning, when the model returns any, kept as an optional field since a saved notebook cannot regain it, and sent back to the model only when configured to, off by default, since doing so cost a median of 81 to 538 prompt tokens per earlier turn in the Phase 0 measurements with no consistent effect on the next call ([results, question 5](phase0-results.md#q5-sending-reasoning-back)); well-formed tool calls; any malformed tool call with its raw text; exact token usage as the serving stack reported it; stop reason, reported model id, duration.

**On Ollama, an unparseable call usually comes back as an empty reply, not an error.** In Phase 0, 4 of 376 responses ended on `stop` with no content and no call, though the model had generated tokens ([S4](phase0-results.md#s4-malformed-tool-calls)). The provider reports these as `empty_reply`, separate from malformed calls, since the dropped text is never seen. Not sending reasoning back, the default above, has a cost: in both Q5 runs, stripping it coincided with empty replies (4 and 3), and keeping it produced none. The pattern is weak, but it is worth watching through `empty_reply` events.

**Use the SDK's `examples/cli-client` as a reference, not a starting point.** It has a provider seam, OpenAI, Anthropic, Gemini and scripted providers, and an agent loop. Its seam lacks exact usage, malformed-call text and streaming, and its OpenAI provider runs an unparseable call with `{}` as its arguments. Too little of it fits to justify copying it, along with its licence notices.

**One provider first:** our own client for OpenAI-compatible Chat Completions (`POST /v1/chat/completions`), with a configurable base URL, covering Ollama, vLLM, LM Studio and hosted OpenAI. It uses `eventsource-parser` to read the stream, reads no environment variables, and never retries. A scripted provider serves the tests. Why not the `openai` package or another library, and why Chat Completions rather than the Responses API: [Model Provider Analysis](model-provider-analysis.md).

**Messages and state are shaped after Responses items,** so a Responses provider, needed if hosted OpenAI becomes a target, is one more adapter that leaves saved state unchanged. A tool call keeps its call id and its raw argument string. An assistant turn has an opaque slot for provider-specific items, such as encrypted reasoning. Usage uses neutral field names.

**The person configures the model endpoint**, the same as the MCP servers: a base URL, and a key if the provider needs one. Whether the records a conversation reads may go to that model is theirs to judge under their own agreements; the app shows which model each conversation uses ([§2.4](#24-cre-main-process)). Keys and tokens live in the OS keychain, never a plain file.

- **A local Ollama:** `http://localhost:11434/v1`, with no key.
- **A remote provider,** self-hosted or hosted: its URL, and the person's own key if it needs one.

The development team's shared Ollama server is a remote provider for this project's developers and maintainers, who use it to build and test MCP features. They reach it through their own SSH tunnel to a local port, so access is gated by each one's SSH account. It is not part of what the CRE offers researchers, though a deployment OICR runs may offer it to that deployment's own users.

**Reproducibility comes from the record, not from everyone using one model.** `run_started` records the provider's URL, the model id it reported, and the model's digest where the provider gives one. Ollama's native API reports the digest, and `/v1/models` does not.

**The provider requires a base URL** and takes a key only if the server needs one. It has no default, so a missing setting is an error rather than a request to a hosted service.

**Every request sends `temperature` and `top_p`:** Ollama's `/v1` sets an omitted one to 1.0, overriding the model's defaults, so `chat` configures explicit defaults.

**A stream that ends without a `finish_reason` is a `model_error`:** Ollama's `/v1` drops an error raised mid-stream and just stops (read from source, not yet observed).

**Ollama truncates silently past the context window.** Its default is 4,096 tokens, `/v1` cannot change it per request, and the Arranger tools and instructions alone take about 3,500 ([results](phase0-results.md#context-length)). Host-core therefore manages the window itself ([Context window](#context-window)); the provider's configuration records its size. Through `/v1`, the app cannot set a local Ollama's window, which is that server's own `OLLAMA_CONTEXT_LENGTH`, so it checks the actual window on connect, as `probeContext.ts` did in Phase 0. Ollama's native `/api/chat` does accept a per-request `num_ctx`; whether host-core uses it is [§5](#5-open-questions) question 9.

`eval` does not stream; `chat` and the CRE do, and still get exact usage ([S3](phase0-results.md#s3-streamed-usage-from-ollama)).

#### Agent Loop

A **turn** is one `generate()` call. A run:

1. Sends the conversation and tools to the model.
2. Classifies the reply: text, well-formed tool calls, a malformed call, an empty reply (above), or a reply cut off at the output limit ([below](#replies-cut-off-at-the-output-limit)).
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
| `input_failed`                                 | The confirmation could not be answered; the call did not run  |
| `rounds_exceeded`                              | The server kept asking for input; the call was abandoned      |
| `cancelled`                                    | The user cancelled the call                                   |
| `transport_error`                              | No usable answer came back; whether the call ran is unknown   |
| Approval denied                                | The user declined the call                                    |
| Malformed call (counts against the call limit) | The call could not be parsed                                  |
| Not run, after a limit or cancellation         | The run stopped before this call                              |
| Restored while waiting on a confirmation       | The confirmation was abandoned; the call did not run          |

**Tool calls run one at a time**, so transcript order is execution order and each client has one call in flight. No Arranger tool gains from parallel calls.

**One run at a time.** Host-core refuses to start a run while one is active in the same conversation. In the desktop app it protects against a double-submit within one running instance; a second launch of the app is a separate process, handled by the OS-level single-instance lock ([§2.4](#24-cre-main-process)). A browser-served version, if one is ever built, is expected to enforce one session per user instead, with the mechanism deferred until then ([§2.4](#24-cre-main-process)). One call in flight per client, and who may answer a question, both depend on it.

**Limits** on turns, tool calls and wall-clock time end the run; `done` names which. **Cancellation** is one `AbortSignal` per run.

**Model errors.** An HTTP error, timeout or refusal from the model server ends the run with a `model_error` event, without retrying. Every earlier tool call already has its message, so the conversation stays valid. `chat` and the CRE show the error and let the user retry. `eval` voids the run, as it does for a parse-failure spike, since the failure belongs to the serving stack.

**Tool result size:** an optional cap on characters sent to the model, with the cut noted in the message and the full result kept in the event. `chat` sets 50,000. `eval` sets none, so scores reflect the server's output rather than a host's truncation, and records the setting in the manifest.

##### Context window

Host-core never lets the serving stack truncate a conversation: Ollama drops the oldest messages first, the user's question among them, and answers anyway.

1. **Before each turn,** it estimates the prompt: the previous turn's `prompt_tokens`, the new messages at a conservative tokens-per-character ratio, and the reply cap, which shares the window.
2. **If that exceeds the window,** the consumer's policy applies:
    - `shorten` (`chat`, UI): in what is sent, replace the oldest tool results with a stub, "Earlier result of `<tool>` omitted to fit the context window; call the tool again if it is needed", until it fits. The system prompt, user and assistant messages, and the latest tool results are never shortened. Emits `context_shortened`.
    - `fail` (`eval`): the run ends, so no score comes from a truncated conversation.
3. **If it still cannot fit,** the run ends, and the consumer suggests a new conversation or a model with a larger window.
4. **Backstop:** if `prompt_tokens` does not grow from one turn to the next with nothing shortened, the serving stack truncated anyway, and the run ends with `model_error`.

When the run ends for either reason, `done` names the context window. Shortening changes only the request: state and events keep every result whole, so the notebook shows them all.

##### Replies cut off at the output limit

A reply that ends on `finish_reason: length` with no tool call ran out of room, usually while reasoning: `qwen3:14b` and `gemma4:12b` each did once in 29 S1 steps ([S1](phase0-results.md#do-models-call-the-tools-correctly)). It emits `output_limit`.

- **With visible text:** the text is kept, marked as cut off, and the run ends. The user can ask the model to continue.
- **With none:** host-core retries once if the consumer allows it (`chat`, UI; not `eval`, where a retry would hide the failure). The retry adds "Your previous reply reached the output limit before you answered. Answer briefly, or call a tool directly." and lowers the reasoning effort where the provider supports it. The failed attempt stays in the events, not the conversation state. The retry counts as a turn.
- **If the retry is cut off too,** the run ends, and the consumer suggests splitting the question.

`done` names the output limit. A retry gets an answer more often than not, but not necessarily a right one: on the step where `qwen3:14b` ran out of room, 3 of 5 sampled attempts made a call, and 1 was correct ([S4](phase0-results.md#s4-malformed-tool-calls)).

##### Empty replies

An empty reply ([above](#llm-provider-interface)) has no tool call, so it cannot get a tool message. Host-core emits `empty_reply`, then:

- **If the consumer allows it** (`chat` and the CRE; not `eval`, which counts it as a parse failure), sends the request once more, without changing the conversation. The failed attempt stays in the events. The retry counts as a turn.
- **If the retry is empty too, or retries are off,** the run ends, and `done` names the parse failure.

In Phase 0, resending an empty reply's request with the same seed reproduced it exactly ([S4](phase0-results.md#s4-malformed-tool-calls)), so the retry uses a new seed when the request set one. Under greedy sampling it will probably fail again.

**Starting from a prompt:** a run can start from a trusted server's prompt, seeding the conversation with its messages and roles. `eval` needs this for the `query_arranger` entrypoint. If the prompt cannot be fetched, the run ends before any model call, with `done` naming the failure.

**Starting from carried content:** a conversation can also start from what the person carried out of another one ([§5](#5-open-questions), question 4). Host-core takes it as the first message, labelled as server text (rule 5 in [§1](#1-overview)), and records an event naming what was carried, from which server, to which, and when. The model may call the servers the person picked with it.

#### Tool Registry

- **Names:** `mcp__<server>__<tool>`, as in the SDK's reference host, reduced to `^[a-zA-Z0-9_-]{1,64}$` for OpenAI-style APIs. MCP tool names may contain `.` and run to 128 characters, so both parts are reduced, and an over-long name is shortened with a deterministic hash suffix. The longest Arranger name is 35 characters, with the server key `arranger`.
- **Routing** reads the registry's map, never the string.
- **Arguments are re-encoded by Ollama** with object keys sorted, so transcripts record them as received, and comparisons of passed-on values ignore key order.
- **Collisions** are checked on every rebuild. One at the start of a run fails it; one found later leaves both tools out and is reported in `tools_changed`.
- **Schemas:** MCP `inputSchema` passes through. Ollama rejects nothing: it keeps a property's `type`, `description`, `enum`, `anyOf`, `properties`, `required` and everything under `items`, and drops the rest, which for the Arranger tools loses only the root `$schema` and bounds the descriptions restate ([S1](phase0-results.md#s1-schema-conversion)). A future schema with `oneOf`, `const` or `$ref` directly on a property would lose it.
- **Rebuilt** at the start of each run, and between turns for servers that opt in to change notifications.
- **The model-facing surface**, the tool definitions and labelled instructions in the provider's request format (OpenAI-style for the first provider), comes from an exported pure function, so `eval` can tokenize it. L1 does not use it: it counts the raw MCP surface instead, so this repository's PR gate does not depend on `mcp-host-core` once it moves ([MCP platform testing](../mcp-platform-testing.md) §3.4). The serving stack's chat template renders it further, so its token count is a stable proxy for the real cost, not the exact figure.

#### Approval Policy

|                      | Pre-call approval                                             | Server confirmation                                      |
| -------------------- | ------------------------------------------------------------- | -------------------------------------------------------- |
| Raised by            | Host-core, before calling a tool                              | The MCP server, inside a call (`input_required`)         |
| Answered by          | A consumer-supplied policy: `allow`, `deny` or `ask` per tool | The consumer only: a person, or `eval`'s scripted policy |
| Without the consumer | No run starts; the policy is required                         | Never asked: `elicitation` is not declared               |
| Events               | `approval_required`, `approval_answered`                      | `input_required`, `input_answered`                       |

The policy sees the conversation's earlier tool calls, across runs, each with its server, which the rule on data crossing connections needs ([§5](#5-open-questions), question 4).

**Invariants:** host-core never answers a server confirmation itself and ships no "approve everything" resolver. The model never sees the question, only the tool message.

**Defaults:** `chat` allows every call, and `--confirm-tools` asks each time. `eval` allows every call; confirmations still follow the case's policy. The UI decides its own.

#### Events

Each event carries a run id, sequence number and timestamp.

| Event                                    | Carries                                                                                                                                | Required by               |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `run_started`                            | Model, provider URL, model digest where available, limits, client name and version; each server's identity, surface hash, capabilities | `eval` (manifest), UI     |
| `tools_changed`                          | Changed servers, new hashes, tools left out and why                                                                                    | All                       |
| `model_request`                          | The provider request except the messages; the message count                                                                            | `eval`                    |
| `token`                                  | Streamed text                                                                                                                          | `chat`, UI                |
| `model_response`                         | Text or tool calls, any reasoning, exact usage, stop reason, duration                                                                  | All                       |
| `malformed_tool_call`                    | The raw output                                                                                                                         | `eval` (`parseFailures`)  |
| `empty_reply`                            | Tokens generated, stop reason, and whether host-core retries; nothing else came back                                                   | `eval` (`parseFailures`)  |
| `context_shortened`                      | The tool results shortened to fit the window, and the estimate before and after                                                        | `chat`, UI                |
| `output_limit`                           | The turn, its output tokens, any visible text, and whether host-core retries                                                           | All                       |
| `model_error`                            | The model server's error: HTTP status, timeout or refusal, with its body                                                               | All; `eval` voids the run |
| `approval_required`, `approval_answered` | The tool call, the decision                                                                                                            | `chat`, UI                |
| `tool_call`                              | Call id, server, tool, arguments                                                                                                       | All                       |
| `input_required`                         | Question id, call id, round, key, message, requested schema                                                                            | All                       |
| `input_answered`                         | Question id, the answer, how long it took                                                                                              | `eval`, UI                |
| `input_state_rejected`                   | Call id, server, how long the question waited                                                                                          | UI, `eval`                |
| `tool_result`                            | Call id, outcome, `isError`, content, structured content, wire time, waiting time                                                      | All                       |
| `done`                                   | Why the run ended, such as a limit, the context window or the output limit, and totals                                                 | All                       |

**Answers come back by id** through `respond(id, answer)`, for approvals and confirmations alike, whether from a terminal, a script or Electron's IPC. It is idempotent and returns `accepted`, `unknown`, `already_answered` or `timed_out`. `pending()` lists what is still open, for a renderer that reloads. Approvals and confirmations each take an optional timeout: an approval that times out counts as denied, and a confirmation is answered `cancel`, which `mcp-client` sends like any other answer. Only host-core keeps these clocks, so `respond`, `pending()` and the events always match what the server was sent. A second clock in `mcp-client` could fire first and leave a question listed as pending whose answer goes nowhere.

#### Conversation State

A model-neutral, serializable message history that a consumer saves and hands back. A saved notebook is its state plus its events. **A pending confirmation is not restored in this version:** the call gets the "abandoned" tool message and the conversation continues. Restoring would need persisting the call's arguments, round and question, plus a way to re-enter a run mid-call, none of which this design has; even built, the answer would still have to land within the server's existing time limit for an answer, so the payoff is narrow: an app closed in the exact gap between a question appearing and the person answering it.

**Not in host-core:** presentation, persistence, Arranger knowledge, reading configuration.

### 2.3 MCP CLI

`apps/mcp-cli`: `chat` and `eval` over one configuration.

**Not published.** Jenkins publishes only `modules/*` (`.dev/docs/release-process.md`). The app runs from a checkout, which keeps the case set's dataset keys off npm.

**Shared:** one Zod-validated config module, the only code that reads `process.env`, documented in `.env.schema`; server configuration (URL, `trusted`, change notifications, and headers whose secrets come from the environment); provider construction; and a JSONL transcript writer.

#### `chat`

- A configurable system prompt, and a configurable reply cap defaulting far above the reference host's 1024 tokens, since reasoning counts against it; with no cap, a runaway could fill the context. Extras such as `reasoning_effort` pass through `extra`.
- A flag to print tool results in full (the reference host shows 200 characters).
- Confirmation messages printed as plain text, with a form built from the requested schema and explicit `decline` and `cancel`.
- `/servers` and `/tools` show the surface. Ctrl-C cancels the run.
- `--transcript <path>` writes the events to a file. The file holds real dataset records and this repository's issues are public, so the command warns before writing, until [§5](#5-open-questions) question 2 is settled.

`chat` replaces the SDK's `examples/cli-client` in `apps/mcp-server/README.md` § Chatting with an LLM.

#### `eval`

The harness in [MCP platform testing](../mcp-platform-testing.md), which owns the metrics, case format, fingerprint and manifest. `eval` owns its runner; `vitest-evals` is not used (that plan's §5.2).

**Where `eval` is built is a team decision, recommended as `apps/mcp-eval` in this repository** ([§5](#5-open-questions), question 3). This section describes its subcommands, which apply the same whether it lands here or as an `mcp-cli` subcommand in the CRE repository.

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
- the `fail` context-window policy and no output-limit or empty-reply retry ([§2.2](#context-window)), each recorded in the manifest;
- rejection classification: parse failures are `malformed_tool_call` events, `empty_reply` events (counted, and reported apart), or calls written as prose; schema rejections start with the SDK's `Input validation error`; the rest are semantic;
- voiding a run that ends in `model_error`, rather than scoring it;
- the manifest fields host-core cannot know: run configuration, case set hash, fingerprint.

**The judge** is a separate provider instance on `JUDGE_MODEL`, called with a `responseFormat`, outside the agent loop.

**Arranger knowledge lives here:** SQON equivalence through `@overture-stack/sqon`, the fingerprint, the case set (loaded from a configured path) and the scorers. `apps/mcp-server` is marked trusted, so `query_arranger` can start a run.

**Local mode starts the built `apps/mcp-server` as a child process**, after the rebuild the harness plan requires. Importing the server's source, as `integration-tests/mcp-server` does, would pull it into `mcp-cli`'s own build. From the CRE repository, this needs a path to an Arranger checkout.

**`eval` never runs from `npm test`.** L1 stays on the raw SDK client, so a bug in this stack cannot hide a server bug.

### 2.4 CRE Main Process

In the CRE repository, as Electron's main process.

**Decided 2026-10-15:** the CRE ships as a standalone desktop app, not a web-hosted service. A deployed website adds DevOps and infrastructure complexity for Overture operators that a local install avoids entirely, so it is not the priority. If a browser-served version is ever built later, it serves only one session per user: a second tab cancels or blocks the first rather than racing it. The exact design and behaviour for that case are deferred until that work starts.

**Decided 2026-10-16: the framework is Electron, not Tauri.** Both build desktop apps from web technology. The two modules this plan builds, `modules/mcp-client` and `modules/mcp-host-core`, are plain Node code (rule 3 of the rules for every component, in [§1](#1-overview)), written once for the CLI, the evaluation harness and this app:

- **Electron** runs that code directly, since its main process is Node.
- **Tauri**'s core is Rust, so the same code would have to run as a sidecar: a separate helper program, compiled for each operating system and processor, talking to the Rust core over a channel this project would have to design.

A spike, a short throwaway experiment, built a real Tauri app with this project's own Node program as its sidecar, and found a current defect that rules Tauri out. On macOS, Tauri gives every sidecar all of the main app's entitlements, the permissions an app declares to the operating system, with no way to give it fewer. Once the main app holds a permission Apple licenses per app, such as push notifications or iCloud, macOS kills the sidecar at launch, while the build and its signature check both report success, so no automated build would notice. One need is shared rather than Tauri's alone: any Node program under macOS's hardened runtime needs permission to generate code as it runs (`allow-jit`), Electron's main process included. Tauri's problem is that it cannot grant the sidecar that one permission without also granting everything else the main app holds.

Tauri's usual advantage, a smaller app, does not bear on the reason for going desktop, which was sparing operators a deployed web service; both frameworks do that equally. Electron also comes with a crash reporter and an auto-updater, where Tauri would need a separate package, with its own trust model, for each. A short Electron spike has since checked it against the evidence that ruled Tauri out: under ad-hoc signing and the hardened runtime, a main-process workload modelled on host-core runs with `allow-jit`; a restricted entitlement stays on the main app, not any helper, when the build gives each binary its entitlements explicitly rather than taking the signing tool's own defaults; and `safeStorage` and the fuses this plan requires work as the requirements below describe. The one case neither spike could test is the same for both: a main app with a real Developer ID certificate and provisioning profile, which this environment does not have. The full evidence is in [mcp-host-packaging-spikes.md](../mcp-host-packaging-spikes.md).

**For readers new to Electron:** an Electron app runs as two halves. The renderer is roughly its user interface, a web page. The main process is roughly its back end, the privileged half that holds tokens, makes every network call and runs host-core. The two talk over IPC, Electron's internal message channel between them. The picture has two limits. Approval and consent prompts are drawn by the main process on purpose, so the renderer can neither fake nor answer them. And "back end" here means a half of the app running on the person's own machine, not a server anyone else reaches, nor the kind of portal back end that holds tokens on a web page's behalf ([roadmap.md](../../roadmap.md#browser-portals-and-token-custody-for-controlled-data-deployments)).

**The CRE's two Electron processes** are its main process (`cre-main` in tables) and its renderer (`cre-renderer`). Neither is a deployed, inbound-reachable service: nothing for an operator to run, expose, or scale. A preload script also exists, since the renderer's hardening ([§2.5](#25-cre-renderer)) requires context isolation, which keeps the page's scripts apart from Electron's internals, and `contextBridge`, Electron's sanctioned way for the page to call into the main process, but it runs inside the renderer's own process, not as a separate one, and isn't named as a component here.

**Host-core runs in the CRE's main process for the first release, not a utility process**, the separate, less privileged helper process Electron can start. Electron's own guidance recommends a utility process for untrusted services, CPU-intensive tasks or crash-prone components, which describes host-core's job closely: it is the one component that parses two independently untrusted inputs, an MCP server's output and a model's output, both already treated as untrusted (rule 5 in [§1](#1-overview)). But `safeStorage`, Electron's interface to the operating system's keychain, where every token host-core needs is kept, works only in the main process, so isolating host-core would mean the main process reads the keychain and hands tokens to host-core over a channel, rather than host-core reading it directly; main for the first release keeps that simpler. Revisit a utility process if either trigger shows up: the main thread stalling under host-core's own work, or how much a compromise of host-core could reach. The second, in practice: a bug in host-core while it runs in the main process reaches the keychain, the app's windows and its approval dialogues; the same bug in a utility process reaches only the tokens the main process has handed it, not the keychain, the windows or the approval dialogues themselves.

The requirements below, and the renderer's in §2.5, use these terms:

| Term                    | Meaning here                                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Context isolation       | The page's scripts run apart from Electron's own internals, so a script injected into the page cannot reach them. |
| The sandbox             | The operating system limits what the renderer's process may do, such as reading files.                            |
| Node integration        | Whether the page may use Node's access to files and processes. It is off here.                                    |
| Content security policy | The page's declared rules for what it may load or contact. Here it allows nothing remote.                         |
| Confused deputy         | A service tricked into using its own authority on someone else's behalf.                                          |
| Fuses                   | Switches fixed when the app is built, each turning off a feature an attacker could misuse.                        |
| Single-instance lock    | Electron's way to stop a second launch from starting a second copy of the app.                                    |

This plan requires that it:

- runs one host-core instance per conversation;
- gives each `mcp-client` the signed-in user's credential, never a shared service credential, which would make the MCP server a confused deputy ([MCP platform testing](../mcp-platform-testing.md) §5.4.1); for an Arranger-backed server, that token's audience names the MCP server, which exchanges it for the search server's ([MCP host: connection authentication](../arranger-auth/mcp-host-connections.md) §3);
- signs the user in as an OAuth public client, with PKCE and the system browser, and keeps tokens in the OS keychain;
- lets only that user answer the instance's approvals and confirmations, including in a shared notebook, each shown through a dialogue it owns, never answerable or fakeable from the renderer;
- keeps model credentials off the renderer process;
- creates the renderer with context isolation and the sandbox on, Node integration off, and a content security policy that loads nothing remote; enforces that in its own process too, by cancelling every request from the renderer's session that is not to the app's own scheme (`session.webRequest.onBeforeRequest`), since a content security policy is declared by the document it constrains;
- refuses renderer navigation and new windows, opens only an allowlist through `shell.openExternal`, refuses permission requests such as camera or microphone, and checks every IPC handler's sender;
- ships with Electron's fuses set: the app's binary cannot be run as a plain Node interpreter, a debugger cannot be attached through command-line flags, and the app refuses to run packaged code altered after it was built (embedded ASAR integrity);
- signs every binary with its own entitlements given explicitly (`optionsForFile`, not a single entitlements file passed to the whole build), so the main app carries none of the signing tool's own default entitlements for camera, microphone, Bluetooth, USB, printing, location or photo-library access, which this plan already refuses as renderer permission requests above and does not need at the operating system's level either ([mcp-host-packaging-spikes.md](../mcp-host-packaging-spikes.md) §3);
- adopts `app.requestSingleInstanceLock()`: on macOS, a notebook opened through Finder or a file association arrives through the `open-file` event, which fires before `ready` and is handled there, not through `second-instance`; on Windows and Linux, a second launch's notebook path is forwarded through `requestSingleInstanceLock`'s own `additionalData` and opened by the `second-instance` listener in the first instance;
- saves state with a version check, so a save based on an older version fails rather than overwriting a newer one, as when a notebook in a synced folder is open on two machines;
- passes events to the renderer over Electron's IPC, takes answers as `respond` calls, and reads `pending()` after the renderer reloads;
- saves state and events per notebook in the app's own data directory, never Documents or the desktop, encrypted with a key held in the OS keychain, and bound to the retention period ([§5](#5-open-questions), question 2);
- takes MCP servers and the model endpoint from the person's own configuration, and shows, in each conversation, which servers and which model it uses, since whether the records it reads may reach them is the person's to judge; a loopback `apps/mcp-server` needs neither TLS nor a token;
- leaves change notifications off;
- keeps one server's data out of the model's requests to another, by whichever way [§5](#5-open-questions), question 4 settles; a refused call names the server and why, and crossing is left to the person's own action, which opens empty;
- runs Electron's crash reporter with `uploadToServer: false`; sending a dump is the person's explicit choice for each crash, made after being told it may contain what they were viewing, and a declined dump is deleted. In a deployment holding controlled data, the crash reporter is not started at all. The operating system's own crash reporting is outside the app's reach and stays with device policy: on macOS its reports hold stack traces and register values rather than the app's memory, while Windows can be configured to collect full memory dumps, which an organization handling controlled data controls by device policy.

### 2.5 CRE Renderer

In the CRE repository, created by the CRE's main process ([§2.4](#24-cre-main-process)) with context isolation and the sandbox on, Node integration off, and a content security policy that loads nothing remote, so it has no network access of its own: every connection is made by the main process on its behalf. This plan requires that it:

- renders events as notebook cells;
- shows `context_shortened` (older results shortened for the model, still in the notebook) and `output_limit` (a retry, or a suggestion to split the question);
- renders server and tool text as text rather than HTML, and notebook-cell markdown with raw HTML off and no remote images, so that a markdown image link cannot send data to an outside address the moment a cell is shown;
- shows each confirmation, approval and third-party consent screen through a dialogue owned by the CRE's main process, never answerable or fakeable from here;
- shows each confirmation with its tool call and how long it has waited, and says "probably expired" on `input_state_rejected`;
- disables input while a run is active in another window;
- holds no credentials.

### 2.6 Shared MCP Server Deployments

Researchers' machines connect to a shared `apps/mcp-server` directly. A deployment that other machines reach therefore needs TLS, authentication on every request, and protection against load from many users. A loopback instance for testing needs none of these: on a loopback bind, `apps/mcp-server` needs neither `MCP_ALLOWED_HOSTS` nor `MCP_REQUEST_STATE_SECRET`.

---

## 3. Phases

### Phase 0: Spikes

First, **upgrade `client`, `server` and `core` to 2.3.0 or later together**, since each pins `core` exactly, and `node` to 2.1.1 (done). S2 and S5 test behaviour read from the 2.3.1 source, so they run on it.

Each spike can change the design, except S2, which confirms it.

**Done on local Ollama, 2026-10-09** ([results](phase0-results.md)). S2 and S5 confirmed the design. S1, S3, S4 and an added S2b (cancellation) changed it, as §2 now states, and found the silent truncation that [Context window](#context-window) handles. Still to do: confirm on the development team's shared server, with the same scripts and `--base-url`.

- **S1: schema conversion.** Send all five Arranger tools' input schemas, including `execute_query`'s unconstrained `sqon`, as OpenAI-style tools through Ollama's `/v1/chat/completions`, the path the provider uses. Confirm the models below call them correctly. Check for `$ref`.
- **S2: `callTool()` against `request()`.** Confirm `callTool(..., { allowInputRequired: true })` fails on `execute_query`'s `input_required` reply with `tools/list` cached, and `request()` completes the round trip.
- **S3: streamed usage from Ollama.** Check whether `stream_options: { include_usage: true }` returns exact usage at the end of a stream on `/v1/chat/completions`. If not, streamed runs report usage as unknown.
- **S4: malformed tool calls.** Collect real examples from the models below: malformed calls returned, calls written as prose, and any the serving stack refuses with an HTTP error (unverified for Ollama). Reasoning output was measured alongside it ([§2.2](#22-mcp-host-core), LLM Provider Interface).
- **S5: a refused confirmation.** Restart a loopback `apps/mcp-server` without `MCP_REQUEST_STATE_SECRET` between question and answer, and record what the client surfaces. The source says `-32602` with `data.reason: 'invalid_request_state'`.

**Models for S1, S3 and S4.** Each spike runs on a local Ollama first. A result is confirmed on the development team's shared Ollama server only once it is solid, since time there is coordinated across the team.

| Where             | Model                    | Why                                                                                                                                       |
| ----------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Local             | `gemma4:e4b`             | Small, and tested with LM Studio before the SDK v2 upgrade. `gemma4:12b` is the step up.                                                  |
| Local             | `qwen3:14b`              | Recommended for tool calling. Thinks before answering.                                                                                    |
| Local             | `granite4.1:8b`          | Recommended for tool calling.                                                                                                             |
| Shared, suggested | `gpt-oss:20b`            | Trained for tool calling. Thinks before answering, so it also tests reasoning output ([§2.2](#22-mcp-host-core), LLM Provider Interface). |
| Shared, suggested | `mistral-small3.1` (24B) | Tool support from another model family, without thinking.                                                                                 |
| Shared, suggested | `gpt-oss:120b`           | The large tier: shows whether a failure on `gpt-oss:20b` comes from model size.                                                           |

The shared server's other chat models suit tool calls less: `gemma3`, `medgemma` and `llama3:70b-instruct` have no tool support in Ollama.

### Phase 1: MCP Client

**Done.** `modules/mcp-client` ([§2.1](#21-mcp-client)), tested against an in-process v2 server with a short-lived `requestState`: confirmation rounds including one with no questions, `input_required` on `prompts/get`, a refused state, `rounds_exceeded`, cancellation, `output_invalid`, a re-read that bypasses the cache, opting in to change notifications, and a hash unchanged by a version bump, cache fields or result-level `_meta`. The unsupported-request path, which a compliant server cannot reach, is tested against a scripted one.

### Phase 2: MCP Host Core

`modules/mcp-host-core` ([§2.2](#22-mcp-host-core)) with the scripted and OpenAI-compatible providers. Tests cover the provider's stream handling (fragments split across reads, a missing `finish_reason`, HTTP errors, abort), every row of the tool-message table, a `model_error`, an empty reply and its retry, refusing a second concurrent run, approval and confirmation timeouts, and a conversation that gets the "abandoned" tool message when it continues past a pending confirmation.

Only how a conversation keeps servers apart waits on [§5](#5-open-questions) question 4. Everything else can be built first.

The module is `"private": true`, so Jenkins's `npm publish -w` loop over `modules/*` skips it with a warning, as npm 11 does for any private workspace. That assumes the Jenkins agent's npm behaves the same, which is unchecked (`.dev/tech-debt.md`).

### Phase 3: MCP CLI `chat`

`apps/mcp-cli` with its config and `chat`. The README section switches to it.

### Phase 4: MCP CLI `eval` (Deferred)

Phases 1 to 4 of [MCP platform testing](../mcp-platform-testing.md), on host-core events. Its spikes R2 to R7 still apply, and R1 is the end-to-end run.

> [!NOTE]
> As of 2026-10-07, work on the `eval` harness will be deferred in favour of completing the CRE sooner. Where it is built is a team decision, recommended as `apps/mcp-eval` in this repository ([§5](#5-open-questions), question 3), confirmed when work resumes.

### Phase 5: Publish `mcp-client` and Migrate to CRE Repository

Publish `mcp-client` under the `rc` dist-tag, by removing `"private": true` from its `package.json`, once the two `modules/mcp-client` hardening entries in `.dev/tech-debt.md` are fixed. Add `'auto'` negotiation if the CRE needs it.

**Packaging:** the `mcp-client` module follows `modules/sqon`: dual ESM and CommonJS through `tsup`, `wireit` builds, `0.0.0-dev` on `main`, `rc` from `release-test`.

Move `mcp-host-core` and `mcp-cli` (with `chat`; `eval` is not built yet) to the CRE repository, and update any documentation already referencing them.

**Decided 2026-10-16: `chat` also ships as a standalone binary**, so running it needs no separate Node install. `eval` stays a plain Node tool, since its audience already has the repository and a build.

**Decided 2026-10-17: `chat` is compiled with Bun's `--compile`** (evidence: [mcp-host-packaging-spikes.md](../mcp-host-packaging-spikes.md)). Bun is used only to build the binary, on one condition: continuous integration runs a smoke suite, a small set of checks on the basics, against the compiled binary itself on every platform `chat` ships for. It covers sign-in, token storage and, specifically, the keychain library, a native module compiled for each platform, rather than relying on the unit tests, which run on Node. The shipped binary carries its own runtime and needs nothing installed on the person's machine, so the rest of the stack takes on no runtime dependency, only a build dependency on whichever machine builds `chat`.

`pkg`, an older packaging tool, was checked and ruled out first, since its output is not actually a single file. Against the remaining alternative, Node's own single-executable feature (`--build-sea`), Bun needed one fix where Node needed three, and produced a smaller binary needing no separate Unicode data file. Node's documentation also still labels that feature "Active development", an unstable base for a shipped binary. The spike compiled only Ink, the terminal interface library, which is plain JavaScript and WebAssembly. The keychain library `chat` actually needs is a native module, the part of a compiled binary most likely to behave differently under Bun's engine than under Node's, which is exactly what the smoke suite has to exercise, on every platform, not only the one the spike ran on.

**Updates:** code-signed releases, checked for updates over HTTPS only, with `electron-updater` verifying the release's signature before applying it; no auto-update path offered where a build has no package-manager-based update mechanism of its own (for example, a plain Linux binary), until a Linux packaging format is chosen, which is open along with the target platforms (below). The update feed's address is fixed inside the signed release itself and cannot be redirected by runtime configuration. An update channel is the highest-leverage attack surface a desktop app has, since one compromised release reaches every installed copy at once; code-signing plus signature verification before install is the standard mitigation. Which infrastructure hosts and serves the update files, and who holds custody of the signing key, are open ([§5](#5-open-questions), question 7); whether to use code-signed, verified auto-updates at all needs no decision.

Target platforms and exactly which phase this lands in are also open.

**The desktop app's own packaging is CRE repository work outside these phases:** builds for each OS, code signing and notarization for macOS and Windows, and auto-update.

---

## 4. Research and Decisions

### 4.1 Decisions

Component-level decisions are stated with their reasons in [§2](#2-components). These span the plan:

| Decision                                       | Why                                                                                                                                                                                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One shared stack for chat, harness and UI      | Separate implementations would drift.                                                                                                                                                                                                                         |
| The `mcp-client` module is published           | The CRE repository depends on it.                                                                                                                                                                                                                             |
| A connection layer separate from the runtime   | `mcp-client` knows nothing about models, so it can be tested and reused alone. The runtime is shared by the CLI and the CRE.                                                                                                                                  |
| `chat` and `eval` in one app                   | They share configuration, providers, servers and the transcript format. An evaluation is a chat with scripted answers and scoring. Provisional: [§5](#5-open-questions), question 3.                                                                          |
| Start in this repository                       | When the CRE repository is ready, `mcp-host-core` and `mcp-cli` move there. Until then, they can be built within this repo alongside the `mcp-client`.                                                                                                        |
| Own the loop rather than adopt a framework     | The Vercel AI SDK hides the exact usage and tool-call fields the harness reads. LangChain's MCP adapter re-runs a call's first round on resume ([research record](../atlas/mcp-client-landscape.md) §3).                                                      |
| Our own Chat Completions client, not a library | Every candidate library either wraps the `openai` package, inheriting its environment reads and retries, or is Vercel-maintained. Chat Completions is mature on local servers, where Responses is not. [Model Provider Analysis](model-provider-analysis.md). |
| SDK 2.3.0 or later (`node` 2.1.1)              | 2.3.0 stops following redirects to other origins; 2.2.0 made list calls read every page.                                                                                                                                                                      |

### 4.2 What Each Consumer Needs

| Need                                                  | Terminal chat                    | Eval harness                                     | CRE (main process)                                                                    | Owned by                      |
| ----------------------------------------------------- | -------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------- | ----------------------------- |
| Connect to an MCP server over Streamable HTTP         | Yes                              | Yes, local or remote mode                        | Yes                                                                                   | `mcp-client`                  |
| Several servers at once                               | Yes                              | No                                               | Yes, unless [§5](#5-open-questions) question 4 settles on one server per conversation | `mcp-host-core`               |
| Pin the protocol revision, or negotiate               | Pin `2026-07-28`                 | Pin                                              | Negotiate, from Phase 5 if needed                                                     | `mcp-client`                  |
| Auth per server                                       | Static header from configuration | Yes, once `MCP_API_KEY` lands                    | The signed-in user's credential                                                       | `mcp-client`                  |
| Choose the model per conversation                     | Flag                             | Pinned per run                                   | User picks                                                                            | `mcp-host-core`               |
| Exact sampling parameters per request                 | Defaults                         | Greedy, seed, engine extras, recorded            | Defaults                                                                              | `mcp-host-core`               |
| Constrained output                                    | No                               | **Required** for the judge                       | No                                                                                    | Provider                      |
| Exact token usage per model call                      | Display only                     | **Required**, it is a metric                     | Display, maybe quotas                                                                 | Provider                      |
| Tokenizing text the model has not been sent           | No                               | **Required** for two token metrics               | No                                                                                    | `eval`                        |
| Streamed model output                                 | Yes                              | No, and recorded as off                          | **Required**                                                                          | Provider                      |
| Server instructions in the system prompt              | Trusted servers                  | Yes, and counted in the static surface           | Trusted servers                                                                       | `mcp-host-core`               |
| Start a conversation from an MCP prompt               | Nice to have                     | **Required** for the `query_arranger` entrypoint | Nice to have                                                                          | `mcp-client`, `mcp-host-core` |
| Pre-call tool approval                                | Optional flag                    | Allow everything                                 | User setting                                                                          | `mcp-host-core`               |
| Answering a server confirmation                       | Terminal prompt                  | Scripted: accept, decline, not advertised        | Dialog, answered by the credential's owner                                            | Consumer, through `respond`   |
| Ordered record of everything that happened            | Printed as it happens            | **Required**, it is the transcript               | **Required**, it becomes notebook cells                                               | `mcp-host-core` events        |
| Telling a malformed tool call from a server rejection | No                               | **Required** (`parseFailures`)                   | Useful for error display                                                              | Provider, `mcp-host-core`     |
| Server time apart from waiting time                   | No                               | **Required** (`serverLatency`)                   | Useful                                                                                | `mcp-client`                  |
| Limits on turns, tool calls and wall-clock time       | Yes                              | Yes, per case                                    | Yes                                                                                   | `mcp-host-core`               |
| Cancellation                                          | Ctrl-C                           | Budget exceeded                                  | User stops a run                                                                      | `mcp-host-core`, `mcp-client` |
| Save and restore a conversation                       | No                               | No                                               | **Required**, notebooks persist                                                       | `mcp-host-core` state         |
| Re-score stored transcripts                           | No                               | **Required** (L3)                                | No                                                                                    | `eval`                        |
| A snapshot of the server's surface                    | `/tools`                         | **Required**, it is hashed                       | Shown when connecting                                                                 | `mcp-client`                  |

None of the "Required" cells conflict. The harness needs exact usage but no streaming, and the CRE the reverse; spike S3 found Ollama gives both at once.

### 4.3 SDK Evidence

Read from the `@modelcontextprotocol/client` 2.3.1 source. Paths are in the SDK repository.

| Claim used above                                                                                                                                              | Where                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Version negotiation defaults to `'legacy'`; a pin fails on anything else                                                                                      | `packages/client/src/client/versionNegotiation.ts`                                                  |
| The automatic handler's context does not identify the call                                                                                                    | `synthesizeInputRequestContext`, `packages/core-internal/src/shared/inputRequiredEngine.ts`         |
| `autoFulfill: false` applies to the whole client; rounds without questions wait 250 ms, max 10 rounds                                                         | `packages/client/src/client/client.ts`, `packages/core-internal/src/shared/inputRequiredDriver.ts`  |
| `callTool()` validates `structuredContent` against a cached `outputSchema`; `request()` does not, nor mirror headers                                          | `Client.callTool`, `packages/client/src/client/client.ts`                                           |
| A refused `requestState` gets `-32602`, `data.reason: 'invalid_request_state'`, whatever the cause                                                            | `packages/server/src/server/server.ts`                                                              |
| List changes arrive only over an auto-opened `subscriptions/listen` stream on `2026-07-28`                                                                    | `packages/client/src/client/client.ts`; `McpServer` defaults in `packages/server/src/server/mcp.ts` |
| The client caches list results by default (`cacheMode: 'use'`); `'refresh'` bypasses it                                                                       | `packages/client/src/client/client.ts`                                                              |
| Results carry `_meta` (SHOULD include `io.modelcontextprotocol/serverInfo`); list results carry `ttlMs` and `cacheScope`                                      | `packages/core-internal/src/types/spec.types.2026-07-28.ts`                                         |
| `@modelcontextprotocol/node` is at 2.1.1, with `server` as a caret peer dependency                                                                            | `packages/middleware/node/package.json`                                                             |
| `connect(transport, { prior })` reuses a saved `server/discover` result                                                                                       | `ConnectOptions`, `packages/client/src/client/client.ts`                                            |
| `AuthProvider`: `token()` per request, one retry after `onUnauthorized()`                                                                                     | `packages/client/src/client/auth.ts`                                                                |
| An abort on a `2026-07-28` HTTP stream closes it without `notifications/cancelled`, and rejects like a timeout                                                | `packages/core-internal/src/shared/protocol.ts`                                                     |
| Sampling, roots and logging deprecated as of `2026-07-28` (SEP-2577); elicitation is not                                                                      | `packages/core-internal/src/types/spec.types.2026-07-28.ts`                                         |
| Tool names may use `.` and run to 128 characters                                                                                                              | `packages/core-internal/src/shared/toolNameValidation.ts`                                           |
| 2.2.0 list pagination fix; 2.3.0 same-origin redirects                                                                                                        | `packages/client/CHANGELOG.md`                                                                      |
| `examples/cli-client` is private, and has no usage, streaming, malformed-call text or name-length handling                                                    | `examples/cli-client`                                                                               |
| List methods return an empty list, without a request, for a capability the server does not advertise                                                          | `packages/client/src/client/client.ts`                                                              |
| A failed `fetch` reaches the caller unwrapped                                                                                                                 | `packages/core-internal/src/shared/protocol.ts`                                                     |
| `fromJsonSchema()` without a validator shares one Ajv instance per process, and Ajv keeps every schema it compiles, serving one with an `$id` from that cache | `packages/client/src/fromJsonSchema.ts`, `packages/core-internal/src/validators/ajvProvider.ts`     |
| `discover()` leaves the server version and capabilities recorded at connect unchanged, and list methods check those capabilities                              | `Client.discover`, `Client.listTools`, `packages/client/src/client/client.ts`                       |
| Only the list methods and `readResource()` read the response cache, and `'refresh'` skips the read                                                            | `_serveFromCache`, `packages/client/src/client/client.ts`                                           |
| A server refuses an embedded input request the client's capabilities do not declare, with `-32021`                                                            | `packages/server/src/server/server.ts`                                                              |
| `cacheHints` sets `ttlMs` and `cacheScope`; `handler.notify` publishes list changes                                                                           | `packages/server/src/server/server.ts`, `packages/server/src/server/createMcpHandler.ts`            |
| Licence: Apache-2.0 for new contributions, MIT for those not relicensed; no NOTICE file                                                                       | `LICENSE`                                                                                           |

---

## 5. Open Questions

Each item states the question, a recommendation, why, and the exact choice left for the team.

1. **Which models the CRE offers at launch** (settled, [§2.2](#llm-provider-interface)). Any OpenAI-compatible endpoint the user configures.
2. **Transcript, eval-record and notebook retention.** Transcripts, `eval` records and saved notebooks hold real records. Notebooks are saved unencrypted on the person's machine today, possibly inside a folder that syncs to the cloud.
    - **Recommended:** saved notebooks expire 30 days after they were last opened; the person may shorten that but not lengthen it, and reopening resets the clock. What is saved goes in the app's own data directory, never Documents or the desktop, which cloud backup commonly syncs, and is encrypted with a key held in the OS keychain, the store already decided for tokens ([MCP host: connection authentication](../arranger-auth/mcp-host-connections.md) §4). Records from controlled data are not saved locally at all. `eval`'s frozen dataset holds open data only, with no registered or controlled records, so its records follow open-data rules wherever the harness runs, a developer's machine included.
    - **Why:** every laptop copy is outside revocation, since revoking access cannot reach it, so a short default bounds how long one exists. The keychain encryption's own limit is the keychain's: it protects against a lost or stolen machine and a copied file, not against malware running as the person, which can already read that keychain.
    - **Team decision:** confirming the 30-day default and whether a person may lengthen it or only shorten it, and whether records from controlled data may ever be saved locally. Recommended: not until question 4 settles. Also a confirmation that the harness's frozen dataset is, or is replaced by, open data only.
3. **Where `eval` is built.** Pull request #1103, "Prepare for MCP Client Implementation", made `mcp-host-core` private and moves it to the CRE repository in Phase 5, which puts it on the opposite side of a repository boundary from the dataset and server version `eval` measures against.
    - **Recommended:** `apps/mcp-eval` in this repository, beside the server it measures, consuming `mcp-host-core` as a published package at a pinned version, which the run manifest, the record of what each evaluation run used, records. Host-core then needs publishing wherever it lives after Phase 5, and publishing it from here costs nothing new, since Jenkins, the team's build server, already publishes every `modules/*` package.
    - **Why:** a published version holds the agent loop fixed while `apps/mcp-server` changes, the way the [harness plan](../mcp-platform-testing.md) pins anything that can change a case's expected answer, whereas a workspace copy in the CRE repository would move with every CRE commit. The cost: `chat` and `eval` stop sharing one app, so provider construction and the transcript writer move into host-core or are written twice, and host-core's API must stay stable across the versions `eval` pins.
    - **Team decision:** (a) `apps/mcp-eval` here, with host-core published, either from this repository or from the CRE repository after the move; or (b) `eval` in `mcp-cli` in the CRE repository with host-core private, needing an Arranger checkout path, a cross-repository CI trigger, and the CRE commit in the manifest as a second moving input. Deciding before Phase 5 lets host-core move once, in its final shape.
4. **Data crossing connections in one conversation**, also recorded in [MCP host: connection authentication](../arranger-auth/mcp-host-connections.md) §6. Once one server's records enter the model's context, a later call to another server can carry them out, or another server's injected text can steer the host into reading more than was asked for. A server may log every request it receives, and so learn about data it is not supposed to know exists.
    - **Decided:** the model can never get one server's data into a request to another server, and never proposes a crossing. Only the person moves data between servers, on purpose, through an action of their own. The action is not there to slow them down: it makes each crossing a conscious choice that is shown and recorded, so where data went, and who chose to send it, can be traced later, which neither a model's call nor a paste can show.
    - **What the researcher sees:** if they ask for something that needs another server, the assistant cannot call it in this conversation, and the app says so, for example: "This conversation holds data from Overture, so the assistant can't send requests to cBioPortal here. To use something from it there, choose Send to another server on a result."
    - **How the person carries data across:**
        1. On a result in the notebook, they choose "Send to another server". The action opens empty, with nothing the model tried to send filled in, and says plainly why it exists, for example: "Sending data to another server is recorded as your own choice, so where it went can be traced later. Only what you select here is sent."
        2. They select what to carry, for example the variant list but not the donor IDs, and pick the destination server (or servers, under way (a) below).
        3. The app shows exactly what will be sent and to which server, and nothing leaves until they confirm.
        4. A new conversation opens, connected only to the servers they picked, with what they carried as its first message.
        5. They carry on in the new conversation. Both conversations show the crossing, for example "Carried to a new conversation with cBioPortal, 14:02" in the first and "Carried from Overture: the variant list" in the new one, and the notebook's events record what was carried, from which server, to which, and when.

        The carried content counts as the person's own for this rule, so the model may call the servers they picked with it. The model still receives it labelled as text that came from a server, as all server text is (rule 5 in [§1](#1-overview)), so instructions hidden in a carried record gain no authority; a fork's copied history keeps the same label. Pasting by hand stays possible, like anything else the person types, but loses that label and leaves no record, so the action is the better way. Anything else that would feed one conversation's output into another's model context, such as a notebook cell drawing on another, counts as crossing and goes through the same action.

    - **Why:** where the records a person reads may go is theirs to judge, but no one agrees to an attack. The app cannot tell a call the person wanted from one that text hidden in a record or a server's answer caused, so asking the person to approve the model's calls would make them the only defence against it; refusing the model's crossings blocks the attack by itself, while the person's own crossing stays their choice and stays visible. The rule does not cover the model, which receives everything a conversation reads and is the person's choice ([§2.2](#llm-provider-interface)), nor the renderer's own network access ([§2.4](#24-cre-main-process), [§2.5](#25-cre-renderer)).
    - **Team decision:** how a conversation keeps servers apart, settled before Phase 2 fixes the approval policy and server configuration. The action's exact interface is the CRE repository's to design.
        - (a) A conversation may connect to several servers; once one server's data is in it, the model's calls to the others are refused.
        - (b) A conversation connects to one server only.

        A server's data means what calls to it returned, not its tool list. Under (a), the other servers' tool descriptions are in the conversation from the start, so text in them can still steer the model's reads; (b) closes that too.

5. **The modules' licence.** This repository is licensed AGPL-3.0, the GNU Affero General Public License. Its section 13, the network-interaction clause, which would have forced a web-hosted CRE to offer source to anyone reaching it over a network, no longer applies now that the CRE ships as a standalone app nobody reaches remotely ([§2.4](#24-cre-main-process)). Distributing the compiled app still carries AGPL's ordinary distribution terms, which reach the whole combined work, not only these modules: an Electron app linking them is distributed under AGPL as a whole, CRE repository included, which constrains that repository's own licence rather than sitting beside it.
    - **Recommended:** keep `mcp-client` and `mcp-host-core` under AGPL-3.0 like the rest of this repository, and license the CRE repository AGPL-3.0 too, so distributing the app as one AGPL work adds no obligation beyond publishing its source, which the team does already. Each new package declares `"license": "AGPL-3.0-or-later"` and ships the licence text from its first commit, as the open entry in `tech-debt.md` on missing `license` fields already asks of every existing package.
    - **Why:** the six other Overture repositories checked on GitHub (Stage, Song, Score, Lectern, Lyric and Maestro) are all AGPL-3.0, and an AGPL work can include MIT libraries such as Electron and `eventsource-parser`, and Apache-2.0 ones, so AGPL is the consistent default. Neither module exists yet, so this is the only point where choosing differently is free, since relicensing after others contribute needs every contributor's consent.
    - **Team decision:** confirming the CRE repository is open source under AGPL-3.0. The alternative applies if the team wants others to embed `mcp-client` or host-core in software under another licence, or to distribute the app through a store whose terms conflict with the AGPL: a permissive licence such as Apache-2.0 for the two modules, chosen before Phase 1 writes `mcp-client`.
6. **Whether to run a crash collection server at all.** The rest of crash reporting is settled ([§2.4](#24-cre-main-process)): no reporter in a deployment holding controlled data, `uploadToServer: false` elsewhere, a dump sent only by the person's explicit per-crash choice, and a declined dump deleted.
    - **Recommended:** none, for now.
    - **Why:** there is no operational need yet, and standing up a collection server is itself one more place dumps, which can hold on-screen records, would be received and stored.
    - **Team decision:** whether to run one at all.
7. **Update infrastructure and signing-key custody.** Code-signed, HTTPS-only, signature-verified auto-updates are settled ([Phase 5](#phase-5-publish-mcp-client-and-migrate-to-cre-repository)); which infrastructure hosts and serves the files, and who holds custody of the signing key, are operations decisions, not engineering ones.
    - **Recommended:** GitHub Releases, where Overture already publishes and which `electron-updater` supports natively; Jenkins builds, and signing goes through a hardware-backed signing service, never a key on a build machine.
    - **Why:** one signing key is the channel's single point of compromise, since one compromised release reaches every installed copy at once, and Windows code-signing keys already have to be held in hardware under the rules certificate authorities follow for code-signing certificates.
    - **Team decision:** confirming GitHub Releases and a hardware-backed signing service, or choosing Jenkins' existing release pipeline or an Overture-controlled distribution point instead. The update feed's address is fixed inside the signed release itself and cannot be redirected by runtime configuration, so moving it to new infrastructure later means publishing a new signed release, not editing a config file.
8. **Forking a notebook from a cell.** Two runs at once in one conversation would split its history, and keeping only the latest branch would lose queries that already ran against controlled data.
    - **Recommended:** an explicit "fork from this cell" action, copying the conversation's history up to that cell into a new conversation, rather than letting two runs share one conversation's history or silently discarding a branch. A researcher can then explore two directions from the same point; each conversation still keeps one run at a time, and the new conversation starts with the same connections as the one it came from and may drop any of them; adding one is a crossing under question 4, made only through the person's own crossing action, so they see what carries over and it is recorded. The fork is a saved notebook under question 2's rules. Nothing in `mcp-client` or host-core changes.
    - **Why:** a tool call against controlled data has happened once it runs, and Usher's log keeps it; two runs sharing one history and dropping one branch would leave the notebook's account of what was queried out of step with that log, not just lose unsaved work.
    - **Team decision:** whether the CRE offers this at all, and if so, in which phase. Not required for the first release.
9. **Native calls for Ollama.** Ollama's native `/api/chat` accepts a per-request `num_ctx`, which `/v1` cannot, and `/api/tags` reports each model's digest, which `/v1/models` does not.
    - **Recommended:** when the configured endpoint is an Ollama server, use its native API only to read the loaded context window (`/api/ps`) and the model's digest (`/api/tags`), and keep every model call on the one Chat Completions provider.
    - **Why:** the person may configure any OpenAI-compatible endpoint ([§2.2](#llm-provider-interface)), so host-core manages the window itself whatever the server, and a native provider would be a second adapter to keep in step for Ollama alone. Phase 0 already worked this way: model calls through `/v1`, and the loaded window read from `/api/ps`.
    - **Team decision:** whether to add a native Ollama provider, which sets the window per request, if the [Context window](#context-window) workarounds prove costly while Phase 2 builds them.

---

## 6. Documents This Changes

**Already updated:**

- [MCP platform testing](../mcp-platform-testing.md) builds the harness on this plan, and records its deferral, the L1 token gate counting the raw surface, and `eval`'s open location. If this plan changes, its §5 and §7 change too.
- [atlas: MCP clients for a 2026-07-28-only server](../atlas/mcp-client-landscape.md) §5.
- `.dev/roadmap.md`: entries for this plan and the harness.
- `.dev/tech-debt.md`: confirmation state bound to the OAuth client rather than the user ([§2.4](#24-cre-main-process)).
- `CHANGELOG.md`: the SDK upgrade.

**Updated with Phase 1:** `AGENTS.md` § Structure, for `modules/mcp-client`.

**When the work lands:** `AGENTS.md` § Structure for `mcp-host-core` and `mcp-cli`, and `apps/mcp-server/README.md` § Chatting with an LLM (Phase 3).
