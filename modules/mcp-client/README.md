# @overture-stack/arranger-mcp-client

One connection to one MCP server over Streamable HTTP, for an MCP host. It wraps the MCP SDK's `Client` (`@modelcontextprotocol/client` 2.3.1 or later), and:

- speaks protocol revision `2026-07-28` only;
- drives server confirmations (`input_required`) itself, so the host sees each round's `requestState`;
- resolves every call with an outcome instead of throwing;
- snapshots the server's surface, with a hash that ignores its version and cache hints.

Not published yet: the package is `private` until the hardening entries for this module in `.dev/tech-debt.md` are fixed (MCP Host Plan, Phase 5).

- Design: [MCP Host Plan](../../.dev/docs/mcp-host/mcp-host-plan.md) §2.1
- Architecture: [`mcp-client` Architecture](docs/architecture.md)

## Usage

```ts
import { McpClient } from '@overture-stack/arranger-mcp-client';

const client = await McpClient.connect({
	url: 'https://mcp.example.org/mcp',
	clientInfo: { name: 'my-host', version: '1.0.0' },
	auth: { headers: { Authorization: `Bearer ${token}` } },
	// Without a resolver, the client does not declare `elicitation`.
	inputResolver: async ({ message, requestedSchema, signal }) => askThePerson(message, requestedSchema, signal),
});

const outcome = await client.callTool('call-1', 'execute_query', args, {
	signal,
	onRound: ({ round, requestState, keys }) => record(round, requestState, keys),
});
if (outcome.outcome === 'result') {
	use(outcome.result);
}

await client.close();
```

`connect` and `refreshSurface` throw on failure; `callTool`, `getPrompt` and `readResource` never do.

`refreshSurface` throws `ReconnectRequiredError`, naming the lists, when a redeploy advertises a list the client did not see at connect. The SDK checks capabilities as they stood at connect, so it would read that list as empty; connect a new client instead. Whenever `refreshSurface` throws, `surface` keeps the previous snapshot.

A tool's result is checked against its `outputSchema` from the latest snapshot. If that schema is larger than `MAX_OUTPUT_SCHEMA_BYTES`, nests deeper than `MAX_OUTPUT_SCHEMA_DEPTH`, or does not compile, the tool still runs, but each result is `output_invalid`.

## Options

| Name                  | Description                                                                                                                                         | Type                                                                | Required     | Default                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------ | --------------------------------- |
| `url`                 | The server's Streamable HTTP endpoint.                                                                                                              | `string \| URL`                                                     | **Required** |                                   |
| `clientInfo`          | This host's name and version, sent to the server.                                                                                                   | `{ name: string; version: string }`                                 | **Required** |                                   |
| `auth`                | Static headers, or an SDK `AuthProvider`, which supplies a token per request and retries once on a 401. Refused over plain HTTP except to loopback. | `{ headers: Record<string, string> } \| { provider: AuthProvider }` | Optional     | None                              |
| `allowInsecureHttp`   | Allows `auth` over plain HTTP to a non-loopback host, which exposes the credential on the network.                                                  | `boolean`                                                           | Optional     | `false`                           |
| `inputResolver`       | Answers each server question with an `ElicitResult`. Without it, the client does not declare `elicitation`, so servers ask nothing.                 | `InputResolver`                                                     | Optional     | None                              |
| `changeNotifications` | Reports which list changed, over a stream held open for the client's life. The list is not re-read: call `refreshSurface()`.                        | `{ onChange: (change: SurfaceChange) => void }`                     | Optional     | None, so no stream is opened      |
| `onError`             | Receives errors raised outside any call, such as a change stream that failed to open. Anything it throws is ignored.                                | `(error: Error) => void`                                            | Optional     | None, so those errors are dropped |
| `requestTimeoutMs`    | Timeout per request leg. Waiting on the resolver is not timed.                                                                                      | `number`                                                            | Optional     | `60_000`, the SDK's default       |
| `maxRounds`           | Retries allowed after the original request.                                                                                                         | `number`                                                            | Optional     | `10`                              |

## Outcomes

Each also carries `wireMs`, `waitingMs` (in the resolver) and `rounds`.

| Outcome                | Meaning                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `result`               | The tool ran. Includes `isError: true`.                                                  |
| `output_invalid`       | The tool ran, but its `structuredContent` failed the tool's `outputSchema`.              |
| `rejected`             | A JSON-RPC error, with its `code`, `message` and `data`.                                 |
| `input_state_rejected` | The server refused the echoed `requestState`, for example once expired.                  |
| `input_failed`         | The client could not answer: an unsupported request, or the resolver or `onRound` threw. |
| `rounds_exceeded`      | Still asking after `maxRounds`.                                                          |
| `cancelled`            | The caller's signal aborted the call.                                                    |
| `transport_error`      | A request leg got no usable answer; `kind` says why.                                     |

## Surface hash

`client.surface` holds the latest snapshot, its hash, and the server's name and version beside it. `toSurfaceSnapshot`, `canonicalizeSurface` and `hashSurface` are exported, so a test can hash a raw SDK client's responses the same way.

## Development

From the repository root:

```sh
npm run build -w modules/mcp-client
npm run test -w modules/mcp-client
npm run typecheck -w modules/mcp-client
```

Tests run against an in-process server, `src/testing/server.ts`, over loopback HTTP.
