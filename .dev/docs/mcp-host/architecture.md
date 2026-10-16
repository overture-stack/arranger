# MCP Host: Architecture

How the pieces of the [MCP Host Plan](mcp-host-plan.md) fit together at run time, from the CRE notebook down to the search server. The plan records each decision and the reason for it. This document draws them.

**Reading the diagrams:** a solid line is decided. A dashed line is open or not built yet, and its label names the question that settles it.

The client's internals are drawn in [mcp-client: Architecture](../../../modules/mcp-client/docs/architecture.md).

## System context

The end state for the CRE desktop app, with the terminal CLI beside it.

```mermaid
flowchart LR
    researcher(["Researcher"])
    developer(["Developer at a terminal"])

    subgraph machine["Researcher's machine"]
        subgraph renderer["CRE renderer: holds no credentials"]
            ui["cre-ui<br/>notebook"]
        end
        subgraph backend["CRE backend process: holds the user's model key and tokens"]
            cs["cre-backend"]
            core["mcp-host-core<br/>one per conversation"]
            clientArranger["mcp-client<br/>for apps/mcp-server"]
            clientOther["mcp-client<br/>for a third-party server"]
        end
        keychain[("OS keychain")]
    end

    subgraph cliProcess["apps/mcp-cli process"]
        cli["mcp-cli<br/>chat, eval"]
        cliCore["mcp-host-core"]
        cliClientArranger["mcp-client"]
    end

    llm["Model provider the user configures<br/>OpenAI-compatible: a local Ollama,<br/>the team's Ollama over SSH, or hosted"]

    subgraph overture["Overture deployment"]
        mcp["apps/mcp-server"]
        search["apps/search-server"]
        es[("Elasticsearch<br/>or OpenSearch")]
        keycloak["Keycloak"]
        usher["Usher"]
    end

    thirdParty["Third-party MCP server<br/>for example cBioPortal"]

    researcher --> ui
    ui -->|"events and respond():<br/>IPC"| cs
    cs --> core
    cs -->|"keys and tokens"| keychain
    cs -->|"sign-in: PKCE,<br/>public client"| keycloak
    core -->|"generate()"| llm
    core --> clientArranger
    core -.->|"data crossing<br/>connections: plan Q7"| clientOther
    clientArranger -->|"Streamable HTTP, 2026-07-28,<br/>the user's token"| mcp
    clientOther -.->|"its own sign-in:<br/>connections §4"| thirdParty
    mcp -->|"GraphQL over HTTP"| search
    search --> es
    mcp -.->|"token exchange:<br/>connections §3"| keycloak
    search -.->|"access decisions:<br/>Usher adapter"| usher

    developer --> cli
    cli --> cliCore
    cliCore --> cliClientArranger
    cliCore -->|"generate()"| llm
    cliClientArranger -->|"Streamable HTTP, 2026-07-28,<br/>the user's token"| mcp
```

The rules behind the boundaries:

- **Credentials never reach the renderer** ([plan §1](mcp-host-plan.md#1-overview), rule 3). The renderer displays untrusted text, so script injected there must find no keys and only a narrow IPC API ([plan §2.5](mcp-host-plan.md#25-cre-ui)).
- **The model key and tokens are the user's own**, kept in the OS keychain. Nothing secret ships in the app ([plan §2.2](mcp-host-plan.md#llm-provider-interface)).
- **Each `mcp-client`** holds one user's credential for one server. An Overture token never reaches a third party, and a third party's token never reaches Overture ([connections](../arranger-auth/mcp-host-connections.md) §4).
- **Text from a server is untrusted** unless the app's shipped configuration marks that server `trusted`. A server the user adds starts untrusted. Instructions, confirmation messages and tool results stay labelled as server output, and the UI renders them as text, never HTML ([plan §1](mcp-host-plan.md#1-overview), rule 5).

The open lines, and what settles each:

| Open item                   | Open because                                                                                 | Settled in                                                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| cre-backend's process       | Electron's main process, or a Node sidecar under Tauri.                                      | [Plan §5](mcp-host-plan.md#5-open-questions) question 9                                                             |
| host-core to a third party  | After controlled data enters the model's context, a call to another server can carry it out. | [Plan §5](mcp-host-plan.md#5-open-questions) question 7, [connections](../arranger-auth/mcp-host-connections.md) §6 |
| mcp-client to a third party | Consent, storage, refresh and revocation of per-person tokens are not designed.              | [Connections](../arranger-auth/mcp-host-connections.md) §4                                                          |
| apps/mcp-server to Keycloak | Today `apps/mcp-server` calls the search server with no credential.                          | [Connections](../arranger-auth/mcp-host-connections.md) §3                                                          |
| search server to Usher      | The Usher adapter is planned, not built.                                                     | [Arranger auth](../arranger-auth/index.md)                                                                          |
| `eval` inside apps/mcp-cli  | `eval` may instead be built as `apps/mcp-eval` in this repository.                           | [Plan §5](mcp-host-plan.md#5-open-questions) question 4                                                             |

## Instances and concurrency

Each conversation gets its own host-core instance, which holds one client per configured server. Two researchers using the same server never share a client, so neither shares a credential.

```mermaid
flowchart LR
    subgraph convA["Researcher A's conversation"]
        coreA["mcp-host-core"]
        a1["mcp-client<br/>for apps/mcp-server"]
    end
    subgraph convB["Researcher B's conversation"]
        coreB["mcp-host-core"]
        b1["mcp-client<br/>for apps/mcp-server"]
        b2["mcp-client<br/>for another server"]
    end
    arranger["apps/mcp-server"]
    other["Another MCP server"]

    coreA --> a1
    coreB --> b1
    coreB --> b2
    a1 -->|"Researcher A's token for apps/mcp-server"| arranger
    b1 -->|"Researcher B's token for apps/mcp-server"| arranger
    b2 -->|"Researcher B's token for the other server"| other
```

What runs at the same time, and why:

| Per          | There is                                                                               | Because                                                                                                                       |
| ------------ | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Conversation | One host-core instance, and one mcp-client per server                                  | A client holds one user's credential for one server, and is never reused ([plan §2.1](mcp-host-plan.md#21-mcp-client))        |
| Conversation | At most one active run. Starting another, for example from a second window, is refused | The next two limits depend on it, and so does who may answer ([plan §2.2](mcp-host-plan.md#agent-loop))                       |
| Run          | One tool call at a time                                                                | Transcript order is execution order ([plan §2.2](mcp-host-plan.md#agent-loop))                                                |
| mcp-client   | At most one call in flight                                                             | A question from the server belongs to that call, so it needs no routing ([plan §2.1](mcp-host-plan.md#the-confirmation-loop)) |
| Call         | Up to `maxRounds` confirmation rounds, 10 by default                                   | A server that keeps asking is stopped with `rounds_exceeded`                                                                  |
| Round        | Any number of questions, asked together                                                | The first to fail withdraws the rest                                                                                          |

A saved notebook is one conversation: its state plus its events ([plan §2.2](mcp-host-plan.md#conversation-state)).

## A question with no confirmation

A researcher asks a question, and the model answers after one tool call. The server asks nothing. Most of the events host-core emits are left out, to keep the flow readable. The full list is in [plan §2.2](mcp-host-plan.md#events).

```mermaid
sequenceDiagram
    autonumber
    actor P as Researcher
    participant UI as cre-ui
    participant CS as cre-backend
    participant HC as mcp-host-core
    participant LLM as Model server
    participant MC as mcp-client
    participant MS as apps/mcp-server
    participant SS as search server

    P->>UI: asks a question
    UI->>CS: message
    CS->>HC: start a run, with the conversation state and a signal
    HC->>MC: refreshSurface()
    MC->>MS: server/discover, lists with cache bypassed
    MS-->>MC: surface
    MC-->>HC: snapshot and hash
    HC-->>CS: run_started
    loop until the model answers in text, a limit is reached, or the run is cancelled
        HC->>LLM: generate(system prompt, messages, tools)
        LLM-->>HC: streamed deltas
        HC-->>CS: token events
        CS-->>UI: token events
        LLM-->>HC: final response: one tool call
        HC-->>CS: model_response, tool_call
        HC->>HC: pre-call approval policy for this tool
        alt policy is ask
            HC-->>CS: approval_required
            CS-->>UI: approval_required
            P->>UI: allows it
            UI->>CS: respond(id, allow)
            CS->>HC: respond(id, allow)
        end
        HC->>MC: callTool(callId, tool, args, signal)
        MC->>MS: tools/call
        MS->>SS: GraphQL, when the tool reads the catalogue
        SS-->>MS: data
        MS-->>MC: CallToolResult
        MC-->>HC: outcome result, with wireMs
        HC-->>CS: tool_result
        HC->>HC: append the tool message
    end
    LLM-->>HC: final response: text
    HC-->>CS: model_response, done
    CS-->>UI: events, rendered as notebook cells
```

- **One tool message per tool call**, whatever the outcome, or the conversation cannot continue. Its fixed wording for each outcome is in [plan §2.2](mcp-host-plan.md#agent-loop).
- **The model never sees an approval or a confirmation**, only the tool message that follows it.
- **Before each turn,** host-core estimates the prompt against the context window and shortens old tool results if needed. The diagram leaves this out ([plan §2.2](mcp-host-plan.md#context-window)).

## A question with a server confirmation

`execute_query` asks the person to confirm the query before it runs. Two different approvals are involved, and they are easy to confuse:

| Step                | Raised by                       | Answered by                                        |
| ------------------- | ------------------------------- | -------------------------------------------------- |
| Pre-call approval   | Host-core, before calling       | Host-core's policy: allow, deny, or ask            |
| Server confirmation | The MCP server, inside the call | The person only. Host-core never answers it itself |

The diagram starts after the model has asked for `execute_query`.

```mermaid
sequenceDiagram
    autonumber
    actor P as Researcher
    participant UI as cre-ui
    participant CS as cre-backend
    participant HC as mcp-host-core
    participant MC as mcp-client
    participant MS as apps/mcp-server
    participant SS as search server

    HC->>HC: pre-call approval: allow
    HC->>MC: callTool(c1, execute_query, args, { signal, onRound })
    MC->>MS: tools/call
    Note over MS: The client declared elicitation, so the server asks.<br/>Without it, execute_query returns an error result<br/>and never runs the query.
    MS-->>MC: input_required: requestState sealing the query's digest,<br/>valid 600 s, and one question, confirm
    MC->>HC: onRound(c1, round 1, requestState, keys)
    HC->>HC: record the pending question and start its timer
    MC->>HC: resolver(questionId c1/1/confirm, message, schema, signal)
    HC-->>CS: input_required
    CS-->>UI: input_required
    UI->>P: dialog: the tool call, the server's message as text,<br/>and how long it has waited

    alt the person confirms
        P->>UI: confirm
        UI->>CS: respond(c1/1/confirm, accept)
        CS->>HC: respond(id, answer): accepted
        HC-->>MC: the resolver settles with accept
        HC-->>CS: input_answered
        MC->>MS: tools/call, with inputResponses and requestState echoed
        Note over MS: Verifies the state, rebuilds the query from args,<br/>and runs it only if its digest matches
        MS->>SS: GraphQL query
        SS-->>MS: hits and aggregations
        MS-->>MC: CallToolResult
        MC-->>HC: result, with waitingMs and rounds 1
    else host-core's timer runs out
        HC-->>MC: the resolver settles with cancel
        MC->>MS: tools/call, with cancel and requestState echoed
        MS-->>MC: CallToolResult: executed false
        MC-->>HC: result: the query did not run
    else the person stops the run
        P->>UI: stop
        UI->>CS: stop
        CS->>HC: abort the run's signal
        MC-->>HC: cancelled, and no retry is sent
    else the answer arrives after the state is refused
        MC->>MS: tools/call, with the answer and requestState
        MS-->>MC: -32602, invalid_request_state
        MC-->>HC: input_state_rejected, with waitedMs
        HC-->>CS: input_state_rejected
        CS-->>UI: "probably expired", when waitedMs is over 600 s
    end
    HC-->>CS: tool_result
```

- **`onRound` runs before the question is asked**, so host-core already holds the `requestState` while it waits. That is why the client drives the rounds itself rather than letting the SDK do it ([plan §2.1](mcp-host-plan.md#the-confirmation-loop)).
- **A UI that reconnects mid-question** calls `pending()` to redraw the dialog. `respond()` is idempotent, and returns `accepted`, `unknown`, `already_answered` or `timed_out`.
- **Closing the app does not resume the question.** The call gets the "abandoned" tool message when the conversation is restored ([plan §5](mcp-host-plan.md#5-open-questions), question 2).

## Cancellation and timeouts

Each clock has exactly one owner. A second clock on the same wait, in `mcp-client`, could fire first and leave a question listed as pending whose answer goes nowhere.

| Clock                   | Owner           | What it times                              | When it runs out                          |
| ----------------------- | --------------- | ------------------------------------------ | ----------------------------------------- |
| Request leg timeout     | The SDK         | One request leg. Default 60 s              | `transport_error`, kind `timeout`         |
| Confirmation timeout    | mcp-host-core   | Waiting for a person to answer the server  | The answer `cancel` is sent to the server |
| Approval timeout        | mcp-host-core   | Waiting for a pre-call approval            | The call counts as denied                 |
| Run limits              | mcp-host-core   | Turns, tool calls and wall-clock time      | The run ends, and `done` names the limit  |
| `requestState` lifetime | apps/mcp-server | Between the question and the answer: 600 s | `input_state_rejected`                    |

Cancelling is one `AbortSignal` per run, passed down to each call:

```mermaid
sequenceDiagram
    actor P as Researcher
    participant CS as cre-backend
    participant HC as mcp-host-core
    participant MC as mcp-client
    participant MS as apps/mcp-server

    P->>CS: stop
    CS->>HC: abort the run's signal
    alt a request leg is on the wire
        HC->>MC: the call's signal aborts
        MC->>MS: the SDK closes the request's stream
        Note over MC,MS: Revision 2026-07-28 over HTTP sends no<br/>notifications/cancelled. The server's handler sees the abort
        MC-->>HC: cancelled
    else the call is waiting for a person
        HC->>MC: the call's signal aborts
        MC-->>HC: cancelled, and no retry is sent
    end
    HC->>HC: write a tool message for every call not yet answered
    HC-->>CS: done
```

`mcp-client` reports `cancelled` from the caller's own signal, not from the SDK's error. Phase 0's S2b found that the SDK raises the same `REQUEST_TIMEOUT` for an abort and a timeout ([results](phase0-results.md#s2b-cancellation-added)).
