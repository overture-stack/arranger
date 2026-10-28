# @overture-stack/mcp-host-core

The agent runtime of an MCP host. One instance runs one conversation: it holds one `@overture-stack/arranger-mcp-client` per configured server, runs a model through a tool-calling loop, and puts every approval and server confirmation in front of the consumer. It:

- names each server's tools `mcp__<server>__<tool>`, reduced to what OpenAI-style APIs accept, and routes calls by its own map;
- runs tool calls one at a time, and one run at a time per conversation;
- gives every tool call a tool message, with fixed wording, so the conversation stays valid however a run ends;
- keeps the conversation inside the model's context window itself, rather than letting the serving stack truncate it;
- reports everything as plain-data events, and keeps a serializable, model-neutral state;
- records what each server has returned, so its data can be kept from reaching another server: every server is restricted unless the person attests it holds only open-access data (MCP Host Plan §5, question 4).

It reads no environment variables and no files: configuration arrives as options. The model is reached through a provider (`LlmProvider`): `OpenAiCompatibleProvider` speaks Chat Completions to Ollama, vLLM, LM Studio or hosted OpenAI, and never retries.

Not published: the package is `private`, and moves to the CRE repository with `apps/mcp-cli` (MCP Host Plan, Phase 5).

- Design: [MCP Host Plan](../../.dev/docs/mcp-host/mcp-host-plan.md) §2.2
- Architecture: [`mcp-host-core` Architecture](docs/architecture.md), and where it sits: [MCP Host: Architecture](../../.dev/docs/mcp-host/architecture.md)

## Usage

```ts
import { McpHost, OpenAiCompatibleProvider } from '@overture-stack/mcp-host-core';

const provider = new OpenAiCompatibleProvider({
	baseUrl: 'http://localhost:11434/v1',
	ollama: true, // read the loaded window and the model's digest natively
});

const host = await McpHost.create({
	servers: [
		{
			key: 'arranger',
			trusted: true,
			connection: { url: 'https://mcp.example.org/mcp', auth: { provider: authProvider } },
		},
	],
	provider,
	model: { model: 'qwen3:14b', temperature: 0.2, topP: 0.9, maxOutputTokens: 8_192 },
	approvalPolicy: () => 'allow',
	confirmations: {},
	limits: { turns: 20, toolCalls: 30, wallClockMs: 600_000 },
	retries: { emptyReply: true, outputLimit: true },
	contextWindow: { tokens: 16_384, policy: 'shorten' },
	toolResultMaxChars: 50_000,
	clientInfo: { name: 'my-host', version: '1.0.0' },
	onEvent: (event) => {
		if (event.type === 'input_required') {
			// Show event.message as text, never HTML, then answer by id.
			host.respond(event.questionId, { action: 'accept', content: { confirm: true } });
		}
	},
});

const done = await host.run({ message: 'How many donors are there?' }, { signal });
const saved = host.state(); // hand back later as `state`

await host.close();
```

`create` throws when a server cannot be reached, a timeout is not a usable number of milliseconds (`TypeError`), or a saved conversation holding restricted data or carried content would gain a server, including a key that now reaches another endpoint (`ServerSetError`). `run` throws only when a run is already active, or carried content is given to a conversation that has begun, and otherwise resolves with the `done` event, emitted once the run is over. `respond` returns `accepted`, `unknown`, `already_answered` or `timed_out`, and throws `TypeError` for an answer that does not fit its question, which stays open; `question_withdrawn` reports a question closed unanswered by a cancellation or the time limit.

A conversation the person carried data into starts with that content, which reaches the model labelled as server text:

```ts
await host.run({
	message: 'Which of these are pathogenic?',
	carried: { text: variantList, from: { server: 'arranger', name: 'Overture' }, carriedAt: new Date().toISOString() },
});
```

## Options

| Name                 | Description                                                                                                                                                                                                                                                                                                                        | Required     | Default            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------ |
| `servers`            | Each server's `key`, `trusted` flag, `containsOnlyOpenData` flag, `connection` (passed to `McpClient.connect`) and `changeNotifications`. Fixed for the conversation. `containsOnlyOpenData` is the person's attestation that the server holds only open-access data, off unless set, so a server's data is restricted by default. | **Required** |                    |
| `provider`           | The model server, behind `generate(request, signal)`.                                                                                                                                                                                                                                                                              | **Required** |                    |
| `model`              | Model id, `temperature`, `topP`, `seed`, `maxOutputTokens`, `responseFormat`, and `extra` fields passed through.                                                                                                                                                                                                                   | **Required** |                    |
| `approvalPolicy`     | Decides each call: `allow`, `deny`, `ask`, or `{ refuse: reason }` for a data crossing. Sees the call, every earlier call in the conversation, and what each connection has returned.                                                                                                                                              | **Required** |                    |
| `confirmations`      | `false` declares no `elicitation`, so servers ask nothing. Otherwise an optional `timeoutMs`, after which the answer is `cancel`.                                                                                                                                                                                                  | **Required** |                    |
| `limits`             | `turns`, `toolCalls` and `wallClockMs`. Reaching one ends the run.                                                                                                                                                                                                                                                                 | **Required** |                    |
| `retries`            | One retry after an empty reply, and after a reply cut off at the output limit with no text. `eval` turns both off.                                                                                                                                                                                                                 | **Required** |                    |
| `contextWindow`      | The window's `tokens`, the `shorten` or `fail` policy, and `charsPerToken` for the estimate.                                                                                                                                                                                                                                       | **Required** |                    |
| `onEvent`            | Receives every event. Anything it throws is ignored.                                                                                                                                                                                                                                                                               | **Required** |                    |
| `clientInfo`         | This host's name and version, sent to each server.                                                                                                                                                                                                                                                                                 | **Required** |                    |
| `systemPrompt`       | The consumer's system prompt. Trusted servers' instructions follow it.                                                                                                                                                                                                                                                             | Optional     | None               |
| `approvalTimeoutMs`  | How long an `ask` waits. One that times out counts as denied.                                                                                                                                                                                                                                                                      | Optional     | No limit           |
| `toolResultMaxChars` | A cap on each tool message, with the cut noted. Events keep the full result.                                                                                                                                                                                                                                                       | Optional     | No cap             |
| `onServerError`      | Receives errors a server's client raises outside any call.                                                                                                                                                                                                                                                                         | Optional     | None, so dropped   |
| `state`              | A saved `host.state()` to continue from.                                                                                                                                                                                                                                                                                           | Optional     | A new conversation |

## The provider

| Option             | Description                                                                                                                                                               | Default  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `baseUrl`          | The OpenAI-compatible base URL. Required, with no default, so a missing setting is an error.                                                                              |          |
| `apiKey`           | A bearer token, or an async function giving one before every request. A 401 is reported, never retried.                                                                   | None     |
| `requestTimeoutMs` | Ends a request that takes longer, as a `timeout` error.                                                                                                                   | No limit |
| `sendReasoning`    | Sends each assistant turn's reasoning back to the model.                                                                                                                  | `false`  |
| `stream`           | Streams the reply; `eval` turns it off.                                                                                                                                   | `true`   |
| `ollama`           | Reads the loaded context window (`/api/ps`) and the model's digest (`/api/tags`) from Ollama's native API. The run uses the smaller of the configured and loaded windows. | `false`  |

## Data crossing

`holdsRestrictedData(connections)` says whether any server has returned restricted data; `carriesRestrictedData(request)` says whether a call would carry another server's restricted data out, the test a policy applies under way (a). A policy refuses a crossing by returning `{ refuse: reason }`.

## How a run ends

`done.reason` is one of `answered`, `turn_limit`, `tool_call_limit`, `time_limit`, `cancelled`, `model_error`, `context_window`, `output_limit`, `empty_reply`, `prompt_failed`, `surface_error` or `tool_collision`. Every tool call has its tool message first, so the conversation can always continue.

## Development

From the repository root, after building `mcp-client`, which the tests import from its `dist/`:

```sh
npm run build -w modules/mcp-client
npm run test -w modules/mcp-host-core
npm run typecheck -w modules/mcp-host-core
```

Tests run against an in-process server, `src/testing/server.ts`, over loopback HTTP, with a scripted provider, `src/testing/scriptedProvider.ts`. The provider's tests use a loopback model server, `src/testing/modelServer.ts`, that splits its stream wherever a test asks.
