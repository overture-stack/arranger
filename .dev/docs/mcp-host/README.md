# MCP Host: Phase 0 Spikes

Research spikes for the [MCP host plan](../mcp-host-plan.md) §3 Phase 0. None of this is product code.

- **[`phase0-results.md`](phase0-results.md):** what the spikes found and what each changed in the plan. Start here.
- **[`scripts/`](scripts):** the code behind those results, kept so the model spikes can be rerun on the shared Ollama server. When Phase 1 and the evaluation harness start, the useful parts move into their tests.
- **`results/`:** raw output, recreated by the scripts and not committed (see the root `.gitignore`).

## Running the scripts

Run each from the repository root with `npx tsx`. They run `apps/mcp-server` in-process with Arranger stubbed, so nothing else needs to be running. `LOG_LEVEL=fatal` quiets the server's logging.

Scripts that call a model need Ollama started with `OLLAMA_CONTEXT_LENGTH=16384` or more; the default 4,096 truncates these conversations silently, and the conversation scripts refuse to run below 16,384. They take `--base-url` (default `http://localhost:11434/v1`) and `--models a,b`.

Run `s2s5.ts` first: it writes `results/tools.json`, which `s3.ts` and `s1Keywords.ts` read.

## Spike scripts

| Script                                       | Spike   | What it does                                                                                                                                                     | Time, four local models    |
| -------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| [`s2s5.ts`](scripts/s2s5.ts)                 | S2, S5  | Calls `execute_query` through the SDK client every way the plan considered, aborts a call in flight, and answers a confirmation on a restarted server. No model. | Seconds                    |
| [`s3.ts`](scripts/s3.ts)                     | S3      | Sends the same request streamed and not streamed, and compares the usage each reports.                                                                           | 2 minutes                  |
| [`s1Keywords.ts`](scripts/s1Keywords.ts)     | S1      | Removes each JSON Schema keyword from each tool in turn and checks whether the prompt shrinks, to find what Ollama drops.                                        | 10 minutes                 |
| [`probeContext.ts`](scripts/probeContext.ts) | Context | Checks that every message of a conversation reaches the prompt, and measures what a pretty-printed tool result costs.                                            | 3 minutes                  |
| [`runStages.ts`](scripts/runStages.ts)       | S1, S4  | Gives each model each step of eight research goals and scores the call it makes. Greedy once for S1; sampled and repeated for S4.                                | S1: 45 minutes; S4: 1 hour |
| [`summarize.ts`](scripts/summarize.ts)       | S1, S4  | Turns a `runStages.ts` run into per-model tables.                                                                                                                | Seconds                    |
| [`replayEmpty.ts`](scripts/replayEmpty.ts)   | S4      | Resends the requests that came back empty, to show the dropped calls reproduce.                                                                                  | 10 minutes                 |
| [`q5.ts`](scripts/q5.ts)                     | Q5      | Sends a model's next step twice, with and without its earlier reasoning, and compares the calls.                                                                 | 1 to 2 hours per run       |

```sh
LOG_LEVEL=fatal npx tsx .dev/docs/mcp-host/scripts/s2s5.ts
npx tsx .dev/docs/mcp-host/scripts/s3.ts
npx tsx .dev/docs/mcp-host/scripts/s1Keywords.ts
LOG_LEVEL=fatal npx tsx .dev/docs/mcp-host/scripts/probeContext.ts
LOG_LEVEL=fatal npx tsx .dev/docs/mcp-host/scripts/runStages.ts --name s1-calls
LOG_LEVEL=fatal npx tsx .dev/docs/mcp-host/scripts/runStages.ts --name s4 --temperature 0.7 --repeats 5 --tools build_sqon,execute_query
LOG_LEVEL=fatal npx tsx .dev/docs/mcp-host/scripts/summarize.ts s4
LOG_LEVEL=fatal npx tsx .dev/docs/mcp-host/scripts/replayEmpty.ts --run s4
LOG_LEVEL=fatal npx tsx .dev/docs/mcp-host/scripts/q5.ts --repeats 6
LOG_LEVEL=fatal npx tsx .dev/docs/mcp-host/scripts/q5.ts --from get_catalogue_fields --hard --repeats 6 --models qwen3:14b,gemma4:e4b
```

For the shared server, add `--base-url <server>/v1` and that server's `--models`. When rerunning S4, keep Ollama's own output (`ollama serve 2>&1 | tee ollama.log`): it logs a warning when it drops a `gemma4` tool call, the confirmation Phase 0 could not get locally.

## Shared modules

Used by the scripts above; none runs on its own.

| Module                                       | Holds                                                                                                                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`testServer.ts`](scripts/testServer.ts)     | An in-process `apps/mcp-server` with Arranger stubbed, as `startServer` assembles it.                                                                                  |
| [`catalogue.ts`](scripts/catalogue.ts)       | The synthetic two-catalogue Arranger the model spikes query, so tool results hold no dataset records.                                                                  |
| [`goals.ts`](scripts/goals.ts)               | The eight research goals and the reference call for each step.                                                                                                         |
| [`conversation.ts`](scripts/conversation.ts) | Builds each step's conversation from real tool results, and scores a model's call: does it parse, is it the right tool, is it schema-valid, does the server accept it. |
| [`ollama.ts`](scripts/ollama.ts)             | A minimal `/v1/chat/completions` client over `fetch`, the command-line options, and the context-window check.                                                          |
