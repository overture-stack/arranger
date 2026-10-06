# MCP clients for a 2026-07-28-only server: research record

Which clients can drive `apps/mcp-server`, why legacy-era clients are refused, and what our own host would have to do.

**Scope.** Researched 2026-09-24. The SDK findings were read from the installed `@modelcontextprotocol/server`, `client` and `node` 2.0.0 packages. The client and library findings come from primary sources (release notes, source, official docs) as they stood on that date. Client support is moving fast. Recheck a row before relying on it, and update this file when one changes.

---

## Conclusions

- **Legacy clients with elicitation are an SDK-supported option, not an impossibility.** It needs a sessionful 2025-era leg in front of the modern handler. It buys nothing today, because LM Studio and `ollmcp` do not declare elicitation on any protocol revision. See [§1](#1-legacy-era-serving-and-elicitation).
- **Clients that work today:**
    - The TypeScript SDK's own `examples/cli-client`.
    - fast-agent.
    - MCP Inspector v2, which has no model.
- **Plausible but unconfirmed:** Claude Code pointed at Ollama. See [§2](#2-client-landscape).
- **LangChain's `langchain.mcp` also works**, with a resume shape that is easy to get wrong and a replay behaviour worth knowing. See [§3](#3-langchain-langchainmcp).
- **Our own host is a small amount of code on the v2 TS client.** The client can fulfil `input_required` rounds through a registered `elicitation/create` handler, but keeps the `requestState` inside the SDK, so the [MCP host plan](../mcp-host-plan.md) drives the rounds itself to record it. See [§5](#5-building-our-own-host-on-the-v2-ts-client).

---

## 1. Legacy-era serving and elicitation

`apps/mcp-server/src/http/server.ts` sets `createMcpHandler(factory, { legacy: 'reject' })`, so a 2025-era client is refused with `-32022`.

**SDK behaviour, as of 2.0.0:**

| Serving mode                 | Can a legacy client complete `execute_query`'s confirmation? | Why                                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `legacy: 'reject'` (current) | No                                                           | No 2025-era serving at all.                                                                                                                     |
| `legacy: 'stateless'`        | No                                                           | Each request gets a fresh instance that never saw `initialize`. So no client capabilities are known, and the shim refuses any embedded request. |
| Sessionful legacy leg        | Yes                                                          | The legacy shim can send real server-to-client requests on a connection that went through `initialize`.                                         |

**The legacy shim.** `ServerOptions.inputRequired.legacyShim` defaults to `true`. Toward a 2025-era request, the shim takes a handler's `inputRequired(...)` return and does three things:

1. Checks the embedded requests against the capabilities declared in `initialize`.
2. Sends each one as a real `elicitation/create`, `sampling/createMessage` or `roots/list` request.
3. Calls the handler again in-process with the collected `inputResponses`.

Other details:

- The configured `requestState.verify` hook runs on each in-process re-entry too.
- `maxRounds` defaults to 8, and each round's server-to-client request times out after `roundTimeoutMs`, which defaults to 600000.
- On `tools/call`, a shim failure comes back as an `isError` result.

**The sessionful pattern the SDK documents.** Route with `isLegacyRequest(request)`. Send legacy traffic to a sessionful `NodeStreamableHTTPServerTransport`, one constructed with a `sessionIdGenerator`. Send everything else to the `legacy: 'reject'` handler. The predicate runs the handler's own classification, so the two routes cannot disagree.

**What adopting it would cost here:**

- `clientCanElicit` in `executeQueryTool.ts` reads only the per-request `_meta` envelope. A 2025-era request has none, so every legacy call would be refused until it also consults the capabilities declared in `initialize`.
- A session map, session expiry and cleanup, GET and DELETE handling, and sticky routing across replicas. The per-request design removed all of that.
- A second serving path, which needs its own tests.

**A cheaper partial option.** `legacy: 'stateless'` would let a legacy client use `list_catalogues`, `get_catalogue_fields` and `build_sqon`. `execute_query` would still refuse it through `clientCanElicit`, since a legacy request never carries an envelope.

**The v2 TS client defaults to the legacy era.** `ClientOptions.versionNegotiation.mode` defaults to `'legacy'`. A client built on the v2 SDK therefore still connects with a 2025-era handshake unless it pins `{ pin: '2026-07-28' }` or uses `'auto'`. `integration-tests/mcp-server/test/mcpClient.ts` pins, and explains why `'auto'` is avoided there.

---

## 2. Client landscape

"Elicitation" means form-mode elicitation. That is what `execute_query` needs: a single required boolean, `confirm`.

| Client                       | Speaks 2026-07-28                                                      | Elicitation                          | Local model                                          | Notes                                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| TS SDK `examples/cli-client` | Yes, with a version pin flag                                           | Yes, both eras                       | OpenAI-compatible base URL (Ollama, vLLM)            | Pass the model explicitly. Setup: `apps/mcp-server/README.md` § Chatting with an LLM.                                       |
| fast-agent                   | Yes, from v0.10.10 (2026-08-23), `protocol_mode: modern`               | Yes                                  | `generic` provider for OpenAI-compatible endpoints   | Python.                                                                                                                     |
| MCP Inspector v2             | Yes, from v2.0.0; 2.8.0 current                                        | Yes, handles `input_required` rounds | No model                                             | `npm run mcp-server:inspect`.                                                                                               |
| Claude Code + Ollama         | Yes: v2 client with 2026-07-28 negotiation is the default from 2.1.274 | Has elicitation dialogs              | Through Ollama's Anthropic-compatible `/v1/messages` | **Unverified:** form elicitation on a 2026-07-28 connection, and whether the default holds with `ANTHROPIC_BASE_URL` set.   |
| Codex CLI                    | Opt-in `mcp_2026_07_28` flag                                           | Form elicitation mentioned           | `--oss` mode                                         | **Unverified:** whether the flag covers user-configured servers. Its headless app-server auto-declines elicitations.        |
| LM Studio 0.4.25             | Unknown (closed source)                                                | **No, on any revision**              | Yes                                                  | An elicitation request ends the tool call with a blank response (lmstudio-bug-tracker #817). Feature request #977 is open.  |
| `ollmcp` 0.35.0              | No: on Python SDK 2.x but still negotiates 2025-11-25                  | **No, on any revision**              | Yes                                                  | Builds `ClientSession` without an elicitation callback, and the Python SDK declares the capability only when one is passed. |
| Goose                        | No (rmcp negotiates 2025-11-25; block/goose issue #11194)              | Yes, 2025 era                        | Yes                                                  |                                                                                                                             |
| VS Code Copilot              | No (microsoft/vscode issue #329848)                                    | Not checked                          | Not checked                                          |                                                                                                                             |
| Open WebUI                   | No (issue #29778), though its backend is on `mcp` 2.1.1                | Not checked                          | Yes                                                  |                                                                                                                             |
| Zed                          | No (draft PR #61625 closed unmerged)                                   | Not checked                          | Yes                                                  |                                                                                                                             |

Cline, Continue, mcphost, oterm and 5ire had no 2026-07-28 issue or PR at all, so assume they are 2025-era only.

**SDK release dates:**

- Python `mcp` 2.0.0 shipped on 2026-07-28 with 2026-07-28 support; 2.2.0 is current. The 1.x line is maintenance only.
- `@modelcontextprotocol/client` 2.0.0 shipped on 2026-07-27; 2.3.1 is current as of 2026-10-05.

### `examples/cli-client` specifics

Read from source at tag `@modelcontextprotocol/client@2.1.0`. `examples/cli-client` is identical between that tag and `main` as of 2026-09-23.

Setup, flags and the client's limits are in `apps/mcp-server/README.md` § Chatting with an LLM. What that section leaves out:

- **Why a clone:** it is not on npm (`@mcp-examples/cli-client`, `private: true`), and its SDK dependencies are `workspace:*`.
- **Server:** besides `--server <url>`, which can be repeated, `--config <path>` or `./config.json` takes `mcpServers` format. A `--server` URL's name is the first hostname label not in a generic list (`mcp`, `api`, `www` and so on), so `127.0.0.1` becomes `127`.
- **Protocol:** the default is `'auto'` negotiation, which falls back to the 2025-era `initialize` on anything it does not recognize as modern. `--legacy` combined with a modern pin throws.
- **Elicitation:**
    - Declares `{ form: {}, url: {} }` by default.
    - `n` or `no` is an **accept** with `confirm: false`, which `execute_query` treats as declined. `decline` and `cancel` give those actions.
    - Three failed answers cancel.
- **Output:** results are cut at 200 characters, and there is no debug flag.
- **Verified by running, 2026-09-24:** the README steps, with Ollama and `qwen3:8b`. That covers:
    - a dummy `OPENAI_API_KEY`;
    - the whole tool workflow, including the `execute_query` confirmation;
    - raising `OLLAMA_CONTEXT_LENGTH` on the Ollama server to stop prompt truncation.
- **Still unverified:** whether Ollama honours the client's reply cap, sent as `max_completion_tokens`, or ignores it.

There is no official per-client matrix of protocol revisions. `modelcontextprotocol.io/clients` redirects to the docs home, and the extensions client matrix does not track revisions.

---

## 3. LangChain `langchain.mcp`

**Works against this server, in beta.** It shipped in `langchain` 1.4.0 (2026-09-03) behind the `langchain[mcp]` extra, and emits a `LangChainBetaWarning`.

- **Dependency chain:** `fastmcp>=4.0.1,<5`, then `fastmcp-slim`, then `mcp>=2,<3`, which speaks 2026-07-28.
- **API:** `async with MCPAdapter(url) as adapter: tools = await adapter.list_tools()`.
- **Elicitation:** every client the adapter builds declares elicitation. The adapter answers a request with a LangGraph `interrupt()`, which needs a checkpointer and a `thread_id`.
- **`langchain-mcp-adapters` is archived** (2026-09-17). Its 0.3.x line is pinned to `mcp<2` and cannot speak 2026-07-28. `MultiServerMCPClient` maps to `MCPAdapter`, and `get_tools()` maps to `list_tools()`.

**The interrupt payload:**

```python
{"type": "mcp_elicitation", "tool_name": "execute_query",
 "requests": [{"key": "...", "message": "...", "mode": "form", "requested_schema": {...}}]}
```

**The resume value is wrapped in `responses` and keyed by each request's `key`:**

```python
req = interrupt_value["requests"][0]
answer = {"action": "accept", "content": {"confirm": True}} if approved else {"action": "decline"}
Command(resume={"responses": {req["key"]: answer}})
```

A bare `{"confirm": True}`, or a bare `{"action": ..., "content": ...}` without the `responses` wrapper, is the wrong shape.

**Replay caveat (inferred from the adapter source, not tested).** On resume, LangGraph re-runs the tool call from its first round, so round one goes to the server again. The server mints a fresh `requestState` for the query as rebuilt at that moment, and the stored answer is sent with it. If the rebuilt query differs from the one the user was shown, the digest check passes against the new query. That is harmless for local testing. It is a reason not to model a host's confirmation flow on this pattern.

**Ollama through LangChain.** `langchain_ollama.ChatOllama(model=..., base_url=..., temperature=..., reasoning=...)` supports tool calling. `langchain_community`'s `ChatOllama` is deprecated. The two live at different module paths, so neither can shadow the other; import from `langchain_ollama`.

---

## 4. Ollama

- **No built-in MCP client.** ollama/ollama issue #7865 is open.
- **OpenAI-compatible endpoints:** `/v1/chat/completions` and `/v1/responses` both support tool calling.
- **Anthropic-compatible `/v1/messages`**, from v0.14.0, supports streaming and tool calling. It does not support `tool_choice`, `count_tokens` or prompt caching.
- **Context window:** the OpenAI-compatible endpoint cannot set `num_ctx`, and Ollama silently truncates past it. Set `OLLAMA_CONTEXT_LENGTH` on the Ollama server, or `num_ctx` in a Modelfile. See [MCP platform testing](../mcp-platform-testing.md) § 5.3.2 for how an evaluation run should pin and check it.
- **Tool-tagged models checked:** `qwen3:8b` (also thinking), `llama3.1:8b`, `gpt-oss:20b` (also thinking).

---

## 5. Building our own host on the v2 TS client

**The client does the multi-round-trip work.** Register an `elicitation/create` handler and declare `capabilities: { elicitation: {} }`. On a 2026-07-28 connection, `client.callTool()` then fulfils each `input_required` round through that handler and retries with the collected `inputResponses` and the `requestState` echoed back unchanged. It resolves with the final result.

- On a 2025-era connection, the same handler answers real server-to-client requests.
- `inputRequired: { autoFulfill: false }` switches to manual rounds for the whole client. A request sent with `allowInputRequired: true` then hands its `input_required` result to the caller, and any other request that gets one throws.

**Automatic mode hides two things a host may need** (2.3.1 source, checked 2026-10-05):

- **Which call is asking.** The handler's context holds only the request key, method, parameters and an abort signal (`synthesizeInputRequestContext` in `inputRequiredEngine.ts`).
- **The `requestState`**, so a pending confirmation cannot be recorded or saved.

**Manual mode needs `client.request()` for `execute_query`.** With `tools/list` cached, `callTool()` checks `structuredContent` against the tool's `outputSchema`, which an `input_required` reply lacks. The SDK's `examples/mrtr` uses `request()`. Read from source, not run.

**Consequences for a host:**

- **Confirmation UI:** in automatic mode the handler is the whole seam, `(message, requestedSchema) => Promise<ElicitResult>`: a terminal prompt in a CLI, a dialog in a UI. The [MCP host plan](../mcp-host-plan.md) uses manual mode instead.
- **Nothing held open** while the user decides. The limit is the `requestState` lifetime, 600 seconds (`CONFIRMATION_TTL_SECONDS` in `apps/mcp-server/src/mcp/requestState.ts`). The server refuses an expired, forged or wrongly bound state identically, so a client can only say a confirmation probably expired.
- **Version pin:** `versionNegotiation: { mode: { pin: '2026-07-28' } }`, since the default is `'legacy'`.
- **Starting points:** `integration-tests/mcp-server/test/mcpClient.ts` has the connect, pin and handler pieces, and the SDK's `examples/cli-client` is a fuller reference host.
