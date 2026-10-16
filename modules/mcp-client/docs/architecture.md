# mcp-client: Architecture

How `@overture-stack/arranger-mcp-client` works inside, drawn from its source. The [README](../README.md) covers usage, options and the outcome table. The [MCP Host Plan](../../../.dev/docs/mcp-host/mcp-host-plan.md) §2.1 records why each choice was made. For where this module sits among the other pieces, see [MCP Host: Architecture](../../../.dev/docs/mcp-host/architecture.md).

Each section names the functions it draws and the test files that cover them.

## Module map

A host creates one `McpClient` per server. `McpClient` owns the SDK's `Client` and hands each call to `runConfirmationLoop`, which turns everything that can happen into a `CallOutcome`.

```mermaid
flowchart LR
    host["Host<br/>(mcp-host-core)"]

    subgraph module["@overture-stack/arranger-mcp-client"]
        client["McpClient<br/>client.ts"]
        loop["runConfirmationLoop<br/>confirmationLoop.ts"]
        classify["classifyError<br/>outcomes.ts"]
        validate["compileOutputValidators<br/>checkToolOutput<br/>outputValidation.ts"]
        surface["toSurfaceSnapshot<br/>hashSurface<br/>surface.ts"]
    end

    subgraph sdk["@modelcontextprotocol/client"]
        sdkClient["Client"]
        transport["StreamableHTTPClientTransport"]
        ajv["AjvJsonSchemaValidator"]
    end

    server["MCP server"]

    host -->|"connect, callTool,<br/>getPrompt, readResource,<br/>refreshSurface, close"| client
    client -->|"each call"| loop
    loop -->|"a leg threw"| classify
    loop -->|"send each leg:<br/>request()"| sdkClient
    client -->|"discover, list*"| sdkClient
    client -->|"each snapshot"| surface
    client -->|"each snapshot,<br/>each result"| validate
    validate --> ajv
    sdkClient --> transport
    transport -->|"Streamable HTTP,<br/>revision 2026-07-28"| server
```

| File                  | Owns                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `client.ts`           | `McpClient`: SDK client options, the credential check, reading the surface, and the four request methods.                             |
| `confirmationLoop.ts` | `runConfirmationLoop`: sending each leg, `input_required` rounds, questions to the resolver, timing. Knows nothing of the SDK client. |
| `outcomes.ts`         | The `CallOutcome` types, and `classifyError`, which maps whatever a leg threw to one outcome.                                         |
| `outputValidation.ts` | Compiling each snapshot's `outputSchema`s on a fresh Ajv instance, and checking a tool's final result against them.                   |
| `surface.ts`          | Building the snapshot from named fields, canonical JSON, and the SHA-256 hash.                                                        |
| `types.ts`            | `InputResolver`, `InputQuestion`, `RoundInfo`, `CallOptions`, and the SDK types re-exported for hosts.                                |

**Not in this module:** models, tool-name namespacing, approvals, event formatting, retries, the timer on waiting for a person, and anything specific to Arranger. Those belong to the host.

`runConfirmationLoop` takes a `send` function rather than the SDK client, so `confirmationLoop.test.ts` drives it with scripted replies, including requests a compliant server never sends.

## Connecting and reading the surface

`McpClient.connect` checks the credential's transport before sending anything. It then reads the server's surface with every cache bypassed.

```mermaid
sequenceDiagram
    autonumber
    participant H as Host
    participant C as McpClient
    participant S as SDK Client
    participant M as MCP server

    H->>C: connect(options, signal)
    C->>C: assertCredentialTransport(url)
    Note over C: Throws if auth would go over plain HTTP<br/>to a non-loopback host without allowInsecureHttp
    C->>S: new Client(clientInfo, options)
    Note over C,S: versionNegotiation pins 2026-07-28<br/>inputRequired.autoFulfill is false<br/>elicitation form is declared only with a resolver<br/>listChanged handlers only on opt-in
    C->>S: connect(StreamableHTTPClientTransport)
    C->>S: discover()
    S->>M: server/discover, never cached
    M-->>S: supportedVersions, capabilities, instructions
    par each list the capabilities advertise
        C->>S: listTools, listResources,<br/>listResourceTemplates, listPrompts<br/>with cacheMode refresh
        S->>M: tools/list, resources/list, ...
        M-->>S: items
    end
    C->>C: toSurfaceSnapshot, hashSurface
    C->>C: compileOutputValidators, on a fresh Ajv instance
    alt the surface was read
        C-->>H: McpClient, with surface set
    else a read failed
        C->>S: close()
        C-->>H: throws
    end
```

`refreshSurface()` runs the same read, from `discover()` onward, and replaces both the snapshot and the compiled validators. Host-core calls it at the start of each run, so a redeploy is seen even though `apps/mcp-server` marks its lists fresh for an hour.

A list the server does not advertise is not requested, and is recorded as empty.

### Change notifications

Off by default. When a host passes `changeNotifications`, the SDK holds a `subscriptions/listen` stream open for the client's life, and the client reports which list changed. It does not re-read the list.

```mermaid
sequenceDiagram
    participant H as Host
    participant C as McpClient
    participant S as SDK Client
    participant M as MCP server

    M-->>S: list changed, on the listen stream
    S->>C: onChanged(error or null)
    C->>H: onChange({ kind, error? })
    Note over H: Between turns, not mid-call
    H->>C: refreshSurface()
```

Errors the SDK raises outside any call, such as a listen stream that failed to open, go to `onError`. Anything `onError` throws is swallowed, since the SDK calls it from inside its own promise handlers.

**Tested in** `client.test.ts` (credential transport, surface reads, change notifications, `onError`).

## Calling a tool

`callTool`, `getPrompt` and `readResource` all go through the private `#call`, which sends with `client.request()` and `allowInputRequired: true`. Only `callTool` then checks the result against the tool's `outputSchema`.

This is the path when the server asks nothing:

```mermaid
sequenceDiagram
    autonumber
    participant H as Host
    participant C as McpClient
    participant L as runConfirmationLoop
    participant S as SDK Client
    participant M as MCP server

    H->>C: callTool(callId, name, args, { signal, onRound })
    C->>L: callId, params, send, resolver, maxRounds
    L->>S: request({ method: tools/call, params }, allowInputRequired)
    S->>M: tools/call
    M-->>S: CallToolResult
    S-->>L: value, not input_required
    L-->>C: result, with wireMs, waitingMs 0, rounds 0
    C->>C: checkToolOutput(validators, name, result)
    alt no outputSchema, isError true, or content matches
        C-->>H: result
    else no structuredContent, content does not match,<br/>or the schema was not compiled
        C-->>H: output_invalid, with the result and why
    end
```

**Why `request()` instead of the SDK's `callTool()`:** `execute_query` declares an `outputSchema`, and its `input_required` reply has no `structuredContent`. With `tools/list` cached, `callTool()` throws `-32600` on that reply, and without the cache it returns the reply mistyped. Phase 0's S2 confirmed both ([results](../../../.dev/docs/mcp-host/phase0-results.md#s2-calltool-against-request)). So this module validates the final result itself.

A schema over `MAX_OUTPUT_SCHEMA_BYTES` (64 KiB) or deeper than `MAX_OUTPUT_SCHEMA_DEPTH` (32 levels) is never compiled, since it comes from the server. The tool still runs, and each of its results is `output_invalid`.

**Tested in** `client.test.ts` (output checks, rejected calls) and `outputValidation.test.ts`.

## The confirmation loop

On revision `2026-07-28`, a server that needs a person's answer replies `input_required` instead of a result. The SDK's automatic handling is off, so `runConfirmationLoop` drives each round itself. Every path out of the loop is one outcome:

```mermaid
flowchart TD
    start(["callTool, getPrompt or readResource"]) --> aborted{"Caller's signal<br/>aborted?"}
    aborted -->|"yes"| cancelled1(["cancelled"])
    aborted -->|"no"| send["send params, plus retry fields<br/>from the previous round"]
    send -->|"throws"| classify(["classifyError:<br/>see How errors become outcomes"])
    send -->|"returns"| isInput{"input_required?"}
    isInput -->|"no"| result(["result<br/>callTool then checks output"])
    isInput -->|"yes"| count["rounds += 1"]
    count --> tooMany{"rounds > maxRounds?"}
    tooMany -->|"yes"| exceeded(["rounds_exceeded"])
    tooMany -->|"no"| onRound["onRound: callId, round,<br/>requestState, keys"]
    onRound -->|"throws"| failedObserver(["input_failed:<br/>resolver_error"])
    onRound --> check["formQuestions checks<br/>every entry before asking any"]
    check -->|"not a form elicitation,<br/>or no resolver"| unsupported(["input_failed:<br/>unsupported_request"])
    check --> anyQuestions{"Any questions?"}
    anyQuestions -->|"no"| pause["Wait 250 ms"]
    pause -->|"aborted"| cancelled2(["cancelled"])
    pause --> retry
    anyQuestions -->|"yes"| ask["Ask the resolver all of them together,<br/>raced against the caller's abort"]
    ask -->|"aborted"| cancelled3(["cancelled"])
    ask -->|"a resolver threw"| failedResolver(["input_failed:<br/>resolver_error"])
    ask -->|"all answered"| retry["retry = this round's inputResponses<br/>and requestState, echoed byte for byte"]
    retry --> aborted
```

Points the diagram cannot show:

- **`maxRounds` counts retries**, not replies. With the default of 10, the eleventh `input_required` ends the call, and that round is never reported to `onRound`.
- **A round without questions still counts toward `maxRounds`.**
- **The whole round is checked before anything is asked.** A round with one form and one URL-mode request asks the person nothing.
- **`#call` never rejects.** Anything unexpected inside the loop becomes `transport_error` with kind `unknown`.

**Tested in** `confirmationLoop.test.ts` (each exit, with scripted replies) and `client.test.ts` (round counting and limits).

## One confirmation round in detail

This is `execute_query` against `apps/mcp-server`, which asks one question, keyed `confirm`, before it runs a query. The shaded span is the part counted as `waitingMs`. Everything else is `wireMs`.

```mermaid
sequenceDiagram
    autonumber
    participant H as Host<br/>(onRound, resolver)
    participant L as runConfirmationLoop
    participant S as SDK Client
    participant M as MCP server

    L->>S: tools/call execute_query(args)
    S->>M: request leg 1
    M-->>L: input_required<br/>requestState, inputRequests.confirm
    L->>H: onRound({ callId c1, round 1, requestState, keys [confirm] })
    Note over H: Host-core records requestState<br/>before anyone is asked
    L->>L: formQuestions: confirm is a form elicitation
    rect rgba(128, 128, 128, 0.15)
        L->>H: resolver({ questionId c1/1/confirm, message,<br/>requestedSchema, signal })
        Note over H: message is untrusted server text:<br/>render it as text, never HTML
        H-->>L: ElicitResult { action accept, content { confirm true } }
    end
    L->>S: tools/call execute_query(args,<br/>inputResponses, requestState)
    S->>M: request leg 2
    Note over M: Verifies requestState before the handler runs.<br/>apps/mcp-server also checks that the query<br/>rebuilt from args is the one confirmed
    M-->>L: CallToolResult
    L-->>H: result, rounds 1, waitingMs, wireMs
```

`questionId` is `${callId}/${round}/${key}`, so it is unique within a run as long as the host's call ids are.

When a round has several questions, the resolver is called for each at once. The first to throw aborts the signal passed to the others, and the call ends `input_failed`.

The ways the second leg can go wrong:

```mermaid
sequenceDiagram
    participant H as Host
    participant L as runConfirmationLoop
    participant M as MCP server

    alt the caller aborts while the resolver waits
        H->>L: signal aborts
        Note over L: The race ends even if the resolver<br/>ignores its own signal
        L-->>H: cancelled, and no retry is sent
    else the server refuses the echoed state
        L->>M: retry with requestState
        M-->>L: -32602, data.reason invalid_request_state
        L-->>H: input_state_rejected, with waitedMs
    else the person declines
        L->>M: retry with action decline
        M-->>L: CallToolResult: executed false
        L-->>H: result, since the server answered
    end
```

A server gives the same error for a state that has expired, was forged, or belongs to another request. After a restart without `MCP_REQUEST_STATE_SECRET`, it gives that error for every earlier state too. The client cannot tell these cases apart. The host compares `waitedMs` with the server's window (600 s for `apps/mcp-server`) and, if it is over, says "probably expired".

**Tested in** `client.test.ts` (answers, declines, aborts, expired state) and `confirmationLoop.test.ts` (withdrawn questions, refused state).

## How errors become outcomes

When a request leg throws, `classifyError` picks the outcome. The checks run top to bottom, and the first match wins.

```mermaid
flowchart TD
    thrown(["A request leg threw"]) --> aborted{"Caller's signal aborted?"}
    aborted -->|"yes"| cancelled(["cancelled"])
    aborted -->|"no"| protocol{"ProtocolError?"}
    protocol -->|"yes"| state{"-32602 with<br/>data.reason invalid_request_state,<br/>on a leg that echoed a requestState?"}
    state -->|"yes"| stateRejected(["input_state_rejected"])
    state -->|"no"| rejected(["rejected:<br/>code, message, data"])
    protocol -->|"no"| unauthorized{"UnauthorizedError?"}
    unauthorized -->|"yes"| kindUnauthorized(["transport_error:<br/>unauthorized"])
    unauthorized -->|"no"| sdkError{"SdkError?"}
    sdkError -->|"yes"| byCode(["transport_error, kind by code:<br/>RequestTimeout: timeout<br/>ConnectionClosed: closed<br/>InvalidResult: invalid_result<br/>NotConnected: not_connected<br/>ClientHttpAuthentication or Forbidden: unauthorized<br/>any other SdkHttpError: http<br/>anything else: unknown"])
    sdkError -->|"no"| typeError{"TypeError?"}
    typeError -->|"yes"| network(["transport_error:<br/>network"])
    typeError -->|"no"| notConnected{"message is<br/>Not connected?"}
    notConnected -->|"yes"| kindNotConnected(["transport_error:<br/>not_connected"])
    notConnected -->|"no"| unknown(["transport_error:<br/>unknown"])
```

- **Abort is checked first** because the SDK reports a caller's abort the same way as a timeout. Only the caller's own signal tells the two apart.
- **A refused state counts only on a leg that echoed one.** On the first leg, `-32602` is an ordinary `rejected`.
- **An undecodable reply is a `transport_error`**, not `rejected`, because whether the tool ran is unknown.
- **A `TypeError` is a failed `fetch`**, which the SDK passes through unwrapped.

**Tested in** `outcomes.test.ts` and `client.test.ts` (timeouts, aborts, lost connections, 401 retries).

## What the surface hash covers

The snapshot is built from named fields, never by stripping fields from the raw results. Stripping every `_meta` key would also delete an input-schema property that happens to be named `_meta`.

```mermaid
flowchart LR
    subgraph raw["What the server returns"]
        discover["server/discover:<br/>supportedVersions, capabilities,<br/>instructions"]
        items["Each list's items,<br/>with their own _meta"]
        resultMeta["Result-level _meta,<br/>including serverInfo"]
        cache["ttlMs, cacheScope,<br/>nextCursor"]
        version["getServerVersion():<br/>name, version"]
    end

    snapshot["SurfaceSnapshot"]
    record["SurfaceRecord, beside the hash:<br/>server name and version, takenAt"]
    dropped["Left out"]
    canonical["canonicalizeSurface:<br/>object keys sorted,<br/>list order kept,<br/>undefined dropped"]
    hash["hashSurface:<br/>SHA-256, lowercase hex"]

    discover --> snapshot
    items --> snapshot
    resultMeta --> dropped
    cache --> dropped
    version --> record
    snapshot --> canonical --> hash
    hash --> record
    snapshot --> record
```

- **Why the version and cache hints are left out:** neither changes what the model sees, so neither should change the hash.
- **Why list order is kept:** the model sees it. Keeping it also lets the evaluation harness catch a server whose list order varies between reads.
- **Exported for tests elsewhere:** `toSurfaceSnapshot`, `canonicalizeSurface` and `hashSurface`, so a contract test can hash a raw SDK client's responses the same way.
- **Safe on hostile input:** `canonicalizeSurface` is iterative, so a deeply nested server schema cannot overflow the stack.

**Tested in** `surface.test.ts` and `client.test.ts` (hash stability, resources and templates).
