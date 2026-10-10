# MCP Host: Phase 0 Spike Results

Evidence for the [MCP host plan](../mcp-host-plan.md) §3 Phase 0. The plan states the design; this records what the spikes found.

**Setup:** MCP SDK 2.3.1; Ollama 0.34.3 on a 24 GiB Apple M5 Pro with `OLLAMA_CONTEXT_LENGTH=16384`; models `gemma4:e4b`, `gemma4:12b`, `qwen3:14b` and `granite4.1:8b`. Not yet confirmed on the shared server. Tool results come from the real tools run against a synthetic catalogue, so no dataset records are involved. The [README](README.md) lists the scripts; their raw output, in `results/`, is not committed.

## Summary

| Spike   | Finding                                                                                                 | Plan change                                                     |
| ------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| S2      | `callTool()` fails on a confirmation once `tools/list` is cached; `request()` works.                    | None: confirmed.                                                |
| S2b     | Aborting closes the stream without `notifications/cancelled`, and errors exactly like a timeout.        | `cancelled` comes from the caller's own signal.                 |
| S5      | A confirmation answered after a restart is refused with `-32602`, and nothing runs.                     | None: confirmed.                                                |
| S3      | A stream ends with exact usage, equal to the non-streamed figure.                                       | Streaming keeps exact usage; the "usage unknown" fallback goes. |
| S1      | Ollama rejects no schema. Models make well-formed calls; failures are in what the calls say.            | None to schemas; two server fixes recorded in tech-debt.        |
| Context | Ollama's default 4,096-token window silently drops the oldest messages, the user's question among them. | Host-core manages the window.                                   |
| S4      | No call arrives malformed; Ollama instead drops some calls and returns an empty reply.                  | New `empty_reply` class; open question 6.                       |
| Q5      | Sending reasoning back costs tokens on every turn, with no consistent effect on quality.                | Store `reasoning`; send it back only when configured.           |

## S2: `callTool()` against `request()`

Two in-process `apps/mcp-server` instances, Arranger stubbed ([`s2s5.ts`](scripts/s2s5.ts)).

| Call                                                               | Result                                                                                          |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `callTool(..., { allowInputRequired: true })` after `listTools()`  | Throws `ProtocolError` `-32600`: "…has an output schema but did not return structured content". |
| The same, with no `listTools()` first                              | Returns the `input_required` result, typed as a `CallToolResult`.                               |
| `callTool()` with `autoFulfill: false` and no `allowInputRequired` | Throws `SdkError` `UNSUPPORTED_RESULT_TYPE`.                                                    |
| `request(..., { allowInputRequired: true })`, answered, retried    | Completes; the stub Arranger ran exactly one query.                                             |

## S2b: cancellation (added)

On `2026-07-28` over Streamable HTTP, aborting a request closes its stream; no `notifications/cancelled` is sent. The server's handler still sees the abort, within 3 ms. But the client gets `SdkError` `REQUEST_TIMEOUT` for an abort and a timeout alike (only a timeout carries `data.timeout`), so the error cannot say which happened.

## S5: a refused confirmation

A question from one instance, answered on another with a different per-process key (as after a restart without `MCP_REQUEST_STATE_SECRET`), throws `ProtocolError` `-32602`, "Invalid or expired requestState", with `data.reason: 'invalid_request_state'`. No query ran. A literal restart was not needed: the key is the only state a restart changes.

## S3: streamed usage from Ollama

All four models ([`s3.ts`](scripts/s3.ts)). With `stream_options: { include_usage: true }`, the stream ends with one chunk holding `usage` and `choices: []`, then `[DONE]`. Its counts equal the non-streamed request's exactly. `completion_tokens` includes reasoning, and reasoning arrives in a `reasoning` field on messages and stream deltas.

## S1: schema conversion

### What reaches the prompt

Each keyword a tool uses was removed in turn; an unchanged `prompt_tokens` means it never reached the prompt ([`s1Keywords.ts`](scripts/s1Keywords.ts)). All four models agree.

- **Nothing is rejected.** Ollama keeps a property's `type`, `description`, `enum`, `anyOf`, `properties` and `required`, and everything under `items` verbatim. It drops everything else.
- **For the Arranger tools, that loses only** the root `$schema` and some `minLength`, `minimum` and `maximum` bounds, which the descriptions restate. `build_sqon`'s `oneOf` sits under `items`, so it survives.
- **No `$ref`** appears in any input schema.
- A future schema with `oneOf`, `const` or `$ref` directly on a property would lose it on Ollama.

### Context length

Ollama gives every model a 4,096-token window unless the server or model sets more, and `/v1` cannot change it per request. Past it, Ollama drops the oldest messages and still answers. The five tools and the server's instructions take about 3,500 tokens, so the first `get_catalogue_fields` result overflowed: at 4,096, adding it _lowered_ `prompt_tokens` from 3,562 to 3,494 ([`probeContext.ts`](scripts/probeContext.ts)). The prompt kept the instructions and tools, and lost the user's question.

The same probe priced that result: 718 tokens pretty-printed, 376 minified (see the tech-debt entry on pretty-printed model-facing JSON).

### Do models call the tools correctly

Eight goals ([`goals.ts`](scripts/goals.ts)), five ordinary and three hard, one stage per step: the model sees the server's instructions, the goal, and every earlier step with its real result, and makes the next call. Greedy, once per stage, 29 stages per model ([`runStages.ts`](scripts/runStages.ts)). "Accepted" means the real tool ran it.

| Model           | `list_catalogues` | `get_catalogue_fields` | `build_sqon` accepted | `build_sqon` right fields | `execute_query` accepted |
| --------------- | ----------------- | ---------------------- | --------------------- | ------------------------- | ------------------------ |
| `gemma4:e4b`    | 8/8               | 8/8                    | 8/8                   | 8/8                       | 5/5                      |
| `gemma4:12b`    | 8/8               | 8/8                    | 5/8                   | 5/8                       | 0/5                      |
| `qwen3:14b`     | 7/8               | 8/8                    | 6/8                   | 7/8                       | 5/5                      |
| `granite4.1:8b` | 8/8               | 8/8                    | 5/8                   | 5/8                       | 5/5                      |

No call was malformed. The failures:

- **A stringified result as `sqon`:** `gemma4:12b` passed the whole `build_sqon` result, as a JSON string, to `execute_query`. Schema validation allows it, since `sqon` has no `type`; the server refuses it with an unhelpful "Invalid SQON at root: Invalid input".
- **`combination` omitted** on a one-clause `build_sqon`, which requires it anyway (`gemma4:12b`, `qwen3:14b`).
- **Invented operators and keys** on hard goals, such as `not-between` and `fieldNames`. The schema or the server rejects each with a clear message.
- **Endless thinking:** twice, a model spent the whole 4,096-token output limit reasoning and ended with `finish_reason: length` and no call. One took 187 seconds.

Ollama also re-encodes tool arguments with object keys sorted, so the arguments a host receives match the model's in value but never in bytes.

## S4: malformed tool calls

The `build_sqon` and `execute_query` stages, sampled at temperature 0.7 with five seeds: 65 responses per model ([`runStages.ts`](scripts/runStages.ts)). "Correct" means the right tool, schema-valid, and accepted by the server.

| Model           | Correct, ordinary | Correct, hard | Unparseable | HTTP error | Empty, `stop` | Empty, `length` | Prose, no call | Median time |
| --------------- | ----------------- | ------------- | ----------- | ---------- | ------------- | --------------- | -------------- | ----------- |
| `gemma4:e4b`    | 44/50             | 12/15         | 0           | 0          | 2             | 0               | 0              | 10 s        |
| `gemma4:12b`    | 21/50             | 7/15          | 0           | 0          | 1             | 0               | 11             | 5 s         |
| `qwen3:14b`     | 44/50             | 8/15          | 0           | 0          | 1             | 2               | 0              | 23 s        |
| `granite4.1:8b` | 46/50             | 5/15          | 0           | 0          | 0             | 0               | 0              | 3 s         |

**No call arrived unparseable, and none was refused with an HTTP error,** across all 376 S1 and S4 responses.

**Instead, Ollama drops calls.** Four responses ended on `stop` with no content and no call, yet `completion_tokens` exceeded what their reasoning accounts for. Two `gemma4:e4b` replies end their reasoning announcing the call ("I will call `execute_query` with: …"). Resending the four requests with the same seed reproduced each exactly ([`replayEmpty.ts`](scripts/replayEmpty.ts)). The dropped text cannot be recovered from the client; Ollama's server log would name `gemma4` drops, and checking it is the remaining confirmation.

Otherwise, failures repeat S1's: `gemma4:12b` stringified `sqon` in all 20 of its `execute_query` calls and answered in prose 11 times, and `qwen3:14b` ran out of output twice on a goal that needs two chained `build_sqon` calls. `granite4.1:8b` was fastest and most reliable on ordinary goals, and weakest on hard ones.

## Q5: sending reasoning back

Plan [question 5](../mcp-host-plan.md#5-open-questions). A thinking model's call runs against the real tool; then its next step is sent twice, with and without its earlier `reasoning`, same seed ([`q5.ts`](scripts/q5.ts)). Temperature 0.7, six seeds per goal.

| Run                                                 | Model        | Correct, with | Correct, without | Only with / only without | Cost of sending it back (prompt tokens) |
| --------------------------------------------------- | ------------ | ------------- | ---------------- | ------------------------ | --------------------------------------- |
| 1: `build_sqon` → `execute_query`, ordinary goals   | `gemma4:e4b` | 24/27         | 19/27            | 5 / 0                    | median 426                              |
|                                                     | `qwen3:14b`  | 22/23         | 23/23            | 0 / 1                    | median 538                              |
| 2: `get_catalogue_fields` → `build_sqon`, all goals | `gemma4:e4b` | 37/48         | 42/48            | 3 / 8                    | median 81                               |
|                                                     | `qwen3:14b`  | 37/48         | 38/48            | 5 / 6                    | median 364                              |

- **No consistent effect on quality.** `gemma4:e4b` did better with reasoning in run 1 and without it in run 2; neither difference is significant (sign tests about 0.06 and 0.23). `qwen3:14b` was level in both.
- **The cost is certain:** sent-back reasoning is rendered into the prompt, at a median of 81 to 538 tokens per earlier turn.
- **One weak pattern:** stripping reasoning produced empty, dropped replies in both runs (4 and 3), and keeping it produced none.
- `gemma4:12b` produced no reasoning on these turns, so the question did not arise for it.
