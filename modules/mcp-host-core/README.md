# @overture-stack/mcp-host-core

The agent runtime of an MCP host. One instance runs one conversation: it connects to every configured MCP server with `@overture-stack/arranger-mcp-client`, drives a model through a tool-calling loop, keeps the conversation within the model's context window, and hands each approval and server confirmation to the consumer.

Everything the host reports is a plain-data event, and a conversation's state is serializable and model-neutral, so it can be saved and resumed.

Configuration is done through `options`, nothing is read from the environment or from files.

The model is reached through a provider (`LlmProvider`): `OpenAiCompatibleProvider` speaks Chat Completions to Ollama, vLLM, LM Studio or hosted OpenAI, and never retries.

Not published yet: the package is `private` until it moves to a repository of its own.

For how it works inside, see [`mcp-host-core` Architecture](docs/architecture.md).

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

`create` throws, before connecting anything:

- `TypeError` for invalid options, such as a timeout that is not a usable number of milliseconds, or model settings the provider refuses.
- `InsecureTransportError`, a `TypeError` re-exported from `mcp-client`, when a server's `auth` would go over plain HTTP to a non-loopback host.
- `ServerSetError` when its servers would break the data-crossing rule (see [Data crossing](#data-crossing)).

After that, it throws whatever connecting throws, such as for an unreachable server, once it has closed the others.

`run` throws only when a run is already active, or carried content is given to a conversation that has begun, and otherwise resolves with the `done` event, emitted once the run is over.

`respond` returns `accepted`, `unknown`, `already_answered` or `timed_out`, and throws `TypeError` for an answer that does not fit its question, which stays open; `question_withdrawn` reports a question closed unanswered by a cancellation or the time limit.

A conversation the person carried data into starts with that content, which reaches the model labelled as server text:

```ts
await host.run({
	message: 'Which of these are pathogenic?',
	carried: { text: variantList, from: { server: 'arranger', name: 'Overture' }, carriedAt: new Date().toISOString() },
});
```

## Options

| Name                 | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Required     | Default            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------ |
| `servers`            | Each server's `key`, `trusted` flag, `containsOnlyOpenData` flag, `connection` (passed to `McpClient.connect`) and `changeNotifications`. Fixed for the conversation. `containsOnlyOpenData` is the person's attestation that the server holds only open-access data, off unless set, so a server's data is restricted by default, and a server without it must be the only one.                                                                                                      | **Required** |                    |
| `provider`           | The model server, behind `generate(request, signal)`.                                                                                                                                                                                                                                                                                                                                                                                                                                 | **Required** |                    |
| `model`              | Model id, `temperature`, `topP`, `seed`, `maxOutputTokens`, `responseFormat`, and `extra` fields passed through. The OpenAI-compatible provider lets `extra` override `temperature`, `top_p` and `response_format`, and refuses `model`, `messages`, `tools`, `stream`, `stream_options`, `n`, `seed`, `max_tokens` and `max_completion_tokens` when the host is created, naming what to use instead. `maxOutputTokens` must be a positive whole number below `contextWindow.tokens`. | **Required** |                    |
| `approvalPolicy`     | Decides each call: `allow`, `deny` or `ask`. Sees only the call: host-core refuses a data crossing before asking.                                                                                                                                                                                                                                                                                                                                                                     | **Required** |                    |
| `confirmations`      | `false` declares no `elicitation`, so servers ask nothing. Otherwise an optional `timeoutMs`, after which the answer is `cancel`.                                                                                                                                                                                                                                                                                                                                                     | **Required** |                    |
| `limits`             | `turns`, `toolCalls` and `wallClockMs`. Reaching one ends the run.                                                                                                                                                                                                                                                                                                                                                                                                                    | **Required** |                    |
| `retries`            | One retry after an empty reply, and after a reply cut off at the output limit with no text. A consumer that wants every failure to count turns both off.                                                                                                                                                                                                                                                                                                                              | **Required** |                    |
| `contextWindow`      | The window's `tokens`, the `shorten` or `fail` policy, and `charsPerToken` for the estimate.                                                                                                                                                                                                                                                                                                                                                                                          | **Required** |                    |
| `onEvent`            | Receives every event. Anything it throws is ignored.                                                                                                                                                                                                                                                                                                                                                                                                                                  | **Required** |                    |
| `clientInfo`         | This host's name and version, sent to each server.                                                                                                                                                                                                                                                                                                                                                                                                                                    | **Required** |                    |
| `systemPrompt`       | The consumer's system prompt. Trusted servers' instructions follow it.                                                                                                                                                                                                                                                                                                                                                                                                                | Optional     | None               |
| `approvalTimeoutMs`  | How long an `ask` waits. One that times out counts as denied.                                                                                                                                                                                                                                                                                                                                                                                                                         | Optional     | No limit           |
| `toolResultMaxChars` | A cap on each tool message, with the cut noted. Events keep the full result.                                                                                                                                                                                                                                                                                                                                                                                                          | Optional     | No cap             |
| `onServerError`      | Receives errors a server's client raises outside any call.                                                                                                                                                                                                                                                                                                                                                                                                                            | Optional     | None, so dropped   |
| `state`              | A saved `host.state()` to continue from.                                                                                                                                                                                                                                                                                                                                                                                                                                              | Optional     | A new conversation |

## The provider

| Option              | Description                                                                                                                                                                                             | Default      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `baseUrl`           | The OpenAI-compatible base URL. Required, with no default, so a missing setting is an error.                                                                                                            |              |
| `apiKey`            | A bearer token, or an async function giving one before every request. A 401 is reported, never retried.                                                                                                 | None         |
| `allowInsecureHttp` | Allows `apiKey` over plain HTTP to a non-loopback host, which exposes it on the network. Off, the constructor throws `InsecureTransportError`, which this package exports.                              | `false`      |
| `outputLimitField`  | The field that carries `maxOutputTokens`: `max_tokens`, which Ollama reads, or `max_completion_tokens`, which OpenAI's reasoning models require. The latter is refused with `ollama`, which ignores it. | `max_tokens` |
| `requestTimeoutMs`  | Ends a request that takes longer, as a `timeout` error.                                                                                                                                                 | No limit     |
| `sendReasoning`     | Sends each assistant turn's reasoning back to the model.                                                                                                                                                | `false`      |
| `stream`            | Streams the reply; a consumer that needs no deltas can turn it off.                                                                                                                                     | `true`       |
| `ollama`            | Reads the loaded context window (`/api/ps`) and the model's digest (`/api/tags`) from Ollama's native API. The run uses the smaller of the configured and loaded windows.                               | `false`      |

## Data crossing

A server's data is restricted unless `containsOnlyOpenData` is set to `true`. Restricted data never reaches another server automatically, whatever the approval policy decides:

- When a server is not flagged `containsOnlyOpenData`, it must be the only server in its conversation. `create` throws `ServerSetError` before connecting anything otherwise.
- A saved conversation holding restricted data or carried content accepts no added server, including a key that now reaches another endpoint.
- A call that would carry restricted data to another server ends as `crossing_refused`, before the approval policy is asked.

`holdsRestrictedData(host.state().servers)` says whether a conversation holds restricted data, for a consumer's own rules, such as whether its records may be saved.

## How a run ends

`done.reason` is one of `answered`, `turn_limit`, `tool_call_limit`, `time_limit`, `cancelled`, `model_error`, `context_window`, `output_limit`, `empty_reply`, `prompt_failed`, `surface_error` or `tool_collision`, also exported as `DONE_REASONS`, such as `DONE_REASONS.ANSWERED`. Every tool call has its tool message first, so the conversation can always continue.

Every other set of values host-core defines is exported the same way, such as `EVENT_TYPES` and `APPROVAL_DECISIONS`. The plain strings stay valid wherever a type expects one.

## Development

From the repository root, after building `mcp-client`, which the tests import from its `dist/`:

```sh
npm run build -w modules/mcp-client
npm run test -w modules/mcp-host-core
npm run typecheck -w modules/mcp-host-core
```

Tests run against an in-process server, `src/testing/server.ts`, over loopback HTTP, with a scripted provider, `src/testing/scriptedProvider.ts`. The provider's tests use a loopback model server, `src/testing/modelServer.ts`, that splits its stream wherever a test asks.
