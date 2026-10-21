# MCP Host: Model Provider Analysis

Host-core reaches a model through a provider, which has one method, `generate(request, signal)` ([MCP Host Plan](mcp-host-plan.md) §2.2). It turns host-core's messages and tools into a model API's wire format, and streams the reply back. This document records which provider was chosen, the alternatives weighed, and what would reopen the choice.

**Decision:** host-core has its own client for OpenAI-compatible Chat Completions (`POST /v1/chat/completions`), using [`eventsource-parser`](https://www.npmjs.com/package/eventsource-parser) to read the stream. It lives in `modules/mcp-host-core/src/providers/`, beside a scripted provider for tests. Host-core's own message and state types are shaped after Responses API items, so a Responses provider can be added later as one more adapter.

Evidence is from 2026-10-20. "Verified" means checked directly that day, in published package source or against a local server. "Reported" means taken from the cited source, docs or changelog, and not re-checked.

---

## 1. What the Provider Must Do

From plan §2.2 and §1:

| Requirement                                                                                                        | Why                                                                                  |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Stream deltas, then return a final response                                                                        | `chat` and the CRE show text as it arrives                                           |
| Exact token usage, including when streaming                                                                        | A metric for `eval`, and the input to host-core's context-window estimate            |
| Read Ollama's `reasoning` field, and send it back when configured                                                  | Thinking models return it outside the standard fields (plan §5 question 5)           |
| Keep a malformed tool call's raw argument text                                                                     | `eval` counts parse failures; substituting `{}` hides them                           |
| Detect an empty reply, a stream that ends without `finish_reason`, and `finish_reason: length`                     | Each maps to its own event (`empty_reply`, `model_error`, `output_limit`)            |
| Temperature, top-p, seed, maximum tokens, a JSON Schema response format, and other fields passed through unchanged | Reproducible runs, the judge's constrained output, and engine extras such as `top_k` |
| `AbortSignal`, timeouts, and the HTTP status and body of an error                                                  | Cancellation, and `model_error` events                                               |
| No automatic retries                                                                                               | A model error ends the run, and the consumer decides whether to retry                |
| No environment reads, including through a dependency                                                               | Plan §1 rule 4: configuration arrives at the app's boundary                          |

---

## 2. Options Evaluated

| Candidate                                    | Version                     | Verdict                | Deciding reason                                                                                                                                |
| -------------------------------------------- | --------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Our own client** with `eventsource-parser` | 4.1.2 (parser)              | **Chosen**             | Meets every requirement by construction. The only dependency is a small, widely used parser.                                                   |
| `openai`                                     | 7.39.0                      | Rejected               | Needs retries and more switched off, and still reads `OPENAI_CUSTOM_HEADERS` whatever options are passed                                       |
| `@ai-sdk/openai-compatible` (Vercel AI SDK)  | 3.0.74                      | Rejected               | The closest fit among the libraries. The team prefers not to depend on Vercel-maintained tooling, and its interface breaks about twice a year. |
| TanStack AI (`@tanstack/ai-openai`)          | 0.70.0 core, 0.30.1 adapter | Rejected               | Built on the `openai` package, so it inherits all of that package's issues and adds its own                                                    |
| LangChain (`@langchain/openai`)              | 1.6.3                       | Rejected               | Retries by default, reads more environment variables, ignores Ollama's `reasoning` field                                                       |
| pi-ai (`@earendil-works/pi-ai`)              | 1.3.0                       | Rejected               | Repairs malformed JSON and replaces failed arguments with `{}`                                                                                 |
| `ollama` (ollama-js)                         | 0.6.4                       | Not a general provider | Ollama only. See [§5](#5-ollamas-native-api).                                                                                                  |

`token.js` (no release since April 2025), `multi-llm-ts` (a thin wrapper over `openai` and `ollama`) and `ollama-ai-provider-v2` (Ollama only, one maintainer) were set aside without a full review.

### `openai`

**Environment reads (verified).** The package reads specific variables by name, through `readEnv(name)` (`internal/utils/env.mjs`), never the whole environment. Most reads are default parameters, which run only when an option is `undefined`:

| Variable                                                                                                               | Read when every option is passed explicitly?                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_ADMIN_KEY`, `OPENAI_ORG_ID`, `OPENAI_PROJECT_ID`, `OPENAI_WEBHOOK_SECRET` | No: pass a value, or `null` (`client.mjs:180`)                                                                                                                                            |
| `OPENAI_LOG`                                                                                                           | No, once `logLevel` is set (`client.mjs:243-244`)                                                                                                                                         |
| `OPENAI_CUSTOM_HEADERS`                                                                                                | **Yes**, unless `provider` or `credential` is set, and neither fits a local server (`client.mjs:250`). Its headers are merged beneath `defaultHeaders` and sent to the configured server. |

The Azure and Bedrock variables are read only by those separate client classes.

**What would need switching off or working around:**

- **Retries:** `maxRetries` defaults to 2, for 408, 429 and 5xx (`client.mjs:1376`, verified). It would be set to 0.
- **Custom headers:** a `fetch` wrapper that sends only known headers would keep `OPENAI_CUSTOM_HEADERS` from leaving the process, though it is still read.
- **`reasoning`:** the `.stream()` helper overwrites unknown delta fields instead of appending them (`lib/ChatCompletionStream.mjs:1361`, verified), so only the last fragment of `reasoning` survives. The provider would accumulate raw chunks itself, which is the same code our own client needs.
- **Types:** `reasoning` is not in the package's types, so casts are needed.
- **Node:** version 7 requires Node 22 or later (verified). The repository declares 20 or later.

**How often it changes (reported):**

- 84 releases between 2025-10-20 and 2026-10-19.
- Version 5 (2025-05) changed the chat streaming helpers.
- Version 7 (2026-07) raised the Node requirement.
- One minor release, 5.12.1, turned tool-call types into unions, which broke code that read `call.function` without checking the type.
- Most changes concern other APIs: of 998 changelog entries in that period, 19 mention chat completions.

### `@ai-sdk/openai-compatible`

Called through its provider interface (`doStream`), without the SDK's agent loop.

- **Verified:**
    - No `process.env` read anywhere in its built code.
    - It reads both `reasoning_content` and `reasoning` (`dist/index.js:480`, `:691`).
- **Reported, from its source:**
    - It keeps a malformed call's raw argument text.
    - It reports a stream without `finish_reason` as an error.
    - It does not retry at this layer.
    - It passes extra body fields through.
- **Against:**
    - The team prefers not to depend on Vercel-maintained tooling.
    - Its provider interface has had three breaking versions (V2 2025-07, V3 2025-12, V4 2026-06; reported).
    - Sending `reasoning` or a malformed call back needs per-message overrides.
    - It needs `zod` and Node 22.

### TanStack AI

Independent of Vercel, MIT-licensed, and under active development (all 0.x, several releases a week).

- **Verified:** `@tanstack/ai-openai` and `@tanstack/openai-base` depend on `openai ^7.30.0`, so everything in the `openai` section above applies.
- **Reported, from its source:**
    - Its OpenAI-compatible adapter rewrites tool schemas into OpenAI's strict form: optional properties become required and nullable, and `additionalProperties: false` is added.
    - The model then sees a different schema from the MCP server's, against plan §2.2's "`inputSchema` passes through", and may send `null` for optional fields.
    - It cannot send `reasoning` back without subclassing.
    - Calling an adapter directly requires a logger class from a subpath the project describes as internal to adapter packages.
    - Its Ollama adapter always reports `stop` or `tool_calls`, so a reply cut off at the output limit is indistinguishable from a finished one.

### LangChain and pi-ai (reported)

- **LangChain:**
    - It defaults to 6 retries.
    - It reads `OPENAI_API_BASE` and `OPENAI_ORGANIZATION` on top of the `openai` package's variables.
    - It reads only `reasoning_content`, not Ollama's `reasoning`.
- **pi-ai:**
    - It silently repairs malformed JSON, and records a failed call's arguments as `{}`.
    - It builds an `openai` client, so it inherits that package's environment reads.

---

## 3. Chat Completions or Responses

**Chat Completions** is stateless. Every request carries the whole conversation as `messages`. The reply is one assistant message, with text and tool calls whose arguments are JSON strings. Tool results go back as `tool` messages. Ollama, vLLM, LM Studio and llama.cpp all implement it, as do most hosted providers.

**Responses** is OpenAI's newer API. Input and output are lists of typed items: messages, function calls, function-call outputs and reasoning. OpenAI can hold the conversation on its servers (`previous_response_id`), and stores responses by default. It carries reasoning between turns, offers hosted tools including a remote MCP tool, and streams named events.

**OpenAI's position (reported):**

- No deprecation date for Chat Completions. The migration guide says "Chat Completions remains supported" and "Responses is recommended for all new projects".
- The Assistants API was the one retired, on 2026-08-26.
- On hosted OpenAI, "Starting with GPT-5.4, Chat Completions does not support tool calling with `reasoning_effort` values other than `none`."

**Local servers:**

- **Ollama** serves `/v1/responses` (verified against 0.34.3), stateless only (reported). Its streaming has an open bug: text followed by a tool call shares one output index, and the final output is reordered ([#18798](https://github.com/ollama/ollama/issues/18798), open since 2026-10-05; verified).
- **llama.cpp** merged "partial" support on 2026-01-21 (verified). It translates Responses into Chat Completions internally.
- **vLLM** has Responses, with open bugs in tools and truncation (reported).
- **LM Studio** is the only one that is stateful (reported).
- Every one of them documents Chat Completions as its main path.

**Which clients default to which (reported):**

- Clients built around hosted OpenAI default to Responses: the Vercel AI SDK's OpenAI provider, OpenAI's Agents SDK, and Codex CLI.
- Clients aimed at local or "OpenAI-compatible" servers default to Chat Completions: opencode, Open WebUI and Cline, and so does the MCP SDK's `examples/cli-client`.
- [Open Responses](https://www.openresponses.org), a specification based on Responses with conformance tests, lists Ollama, vLLM, LM Studio, Hugging Face and OpenAI among its partners. It is the main sign that local servers will converge on Responses.

**Why Chat Completions first:**

1. The first targets are a researcher's own Ollama and the team's shared Ollama, where Chat Completions is mature and Responses is not. Every Phase 0 measurement was taken on Chat Completions.
2. Host-core owns the conversation, so OpenAI-held state is not wanted. On hosted OpenAI, the default storage would also put controlled data on a third party's servers ([data crossing connections](data-crossing-options.md)).
3. Host-core owns the tool loop, so every MCP call goes through `mcp-client`. Responses' hosted MCP tool would bypass approvals, server confirmations and per-user credentials.

**What would add a Responses provider:** hosted OpenAI reasoning models becoming a primary target, or a local server shipping features only on Responses. It would be a second provider behind the same `generate()` interface, not a replacement.

**How host-core stays ready for it:**

- Tool calls keep a call id and the raw argument string.
- Assistant turns have an opaque slot for provider-specific items, such as encrypted reasoning.
- Usage uses neutral field names.

A Responses provider then maps to and from those types without changing a saved notebook.

---

## 4. Cost of Our Own Client

**Most of the code is the same under any option.** With a library, host-core still writes the request mapping, tool-call fragment accumulation, `reasoning`, empty-reply and missing-`finish_reason` detection, and the mapping to events.

|                                           | Estimate (reported)                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| Production code with the `openai` package | About 150 to 200 lines                                                 |
| Production code for our own client        | About 240 to 320 lines                                                 |
| Extra tests for our own client            | About 100 to 150 lines, for chunk boundaries, error statuses and abort |

The extra code is the wire types, the HTTP error mapping and the stream handling. `eventsource-parser` handles SSE framing.

**What it depends on changes slowly.** The Chat Completions wire format has changed only by addition in about three years (reported):

- tools (2023-11)
- `stream_options.include_usage` (2024-05)
- `json_schema` response formats (2024-08)
- `max_completion_tokens` (2024-09)
- the `developer` role and `reasoning_effort` (2024-12)

Local servers implement the format and must keep it stable for their own users. Adding a field is one line in the request mapping, or none at all through `extra`.

**Ollama ignores some fields** (reported): it accepts `max_tokens` but not `max_completion_tokens`, and has no `tool_choice` or `top_k`.

**`eventsource-parser`:** MIT, no dependencies, about 51 million downloads a week, and maintained by an independent developer (verified on npm).

---

## 5. Ollama's Native API

Ollama's `/v1` endpoint cannot set the context window per request, so host-core manages the window itself (plan §2.2, Context window). Ollama's native API fills two of `/v1`'s gaps:

- `/api/chat` accepts a per-request `num_ctx`;
- `/api/tags` reports each model's digest, which `/v1/models` does not (verified).

Whether host-core uses native calls for the window and digest only, or as a second provider, is plan §5 question 9.

---

## 6. What Would Reopen This Decision

- Hosted OpenAI, Azure or the Responses API becoming a primary target, where a maintained library carries more of the work.
- A need for automatic retry with `retry-after` backoff.
- A non-Vercel library reaching 1.0 that passes MCP input schemas through unchanged, reads no environment variables, and keeps raw tool-call text.

---

## Sources

- **Package source, read on 2026-10-20:**
    - `openai` 7.39.0
    - `@ai-sdk/openai-compatible` 3.0.74
    - `@tanstack/ai` 0.70.0, `@tanstack/ai-openai` 0.30.1, `@tanstack/openai-base` 0.15.0, `@tanstack/ai-ollama` 0.12.1
    - `@langchain/openai` 1.6.3
    - `@earendil-works/pi-ai` 1.3.0
    - `ollama` 0.6.4
- **Release history:** `npm view <package> time`.
- **OpenAI:**
    - [Migrate to the Responses API](https://developers.openai.com/api/docs/guides/migrate-to-responses)
    - [Responses vs Chat Completions](https://developers.openai.com/api/docs/guides/responses-vs-chat-completions)
    - [Deprecations](https://developers.openai.com/api/docs/deprecations)
- **Ollama:**
    - [OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility)
    - [`openai/openai.go`](https://github.com/ollama/ollama/blob/main/openai/openai.go)
    - [issue #18798](https://github.com/ollama/ollama/issues/18798)
- **llama.cpp:** [PR #18486](https://github.com/ggml-org/llama.cpp/pull/18486).
- **Open Responses:** [openresponses.org](https://www.openresponses.org).
