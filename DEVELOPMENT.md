# Development Guide

Internal guide for developers working on this codebase — local setup, repo structure, development workflow, and AI tooling conventions.

For community contribution guidelines (forks, PRs, code of conduct) see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Prerequisites

- [Node.js](https://nodejs.org/) v22 or higher
- [Docker](https://www.docker.com/) v4.39.0 or higher

---

## Repo structure

This is an npm workspaces monorepo managed with [Turborepo](https://turbo.build/).

```
modules/
  types           — shared TypeScript types; consumed by all other modules
  sqon            — SQON query builder
  graphql-router  — GraphQL server, query validation, SearchClient abstraction
  components      — React UI component library
  charts          — chart components

apps/
  search-server   — Express server; reads process.env, wires modules together
  mcp-server      — MCP server

integration-tests/
  server          — full-stack integration tests against a running search engine
  import          — npm package import/indexing integration tests
```

**Key convention:** modules do not read `process.env`. Configuration flows in as typed function parameters. Only `apps/` read the environment.

---

## Local development

Start a local search engine and seed test data:

```bash
make start          # starts Elasticsearch via docker-compose
make seed-es        # seeds test documents
```

The local stack runs without authentication. If you need to test against a secured cluster (OpenSearch or Elasticsearch with the security plugin enabled), see the [search engine permissions reference](docs/setup.md#search-engine-permissions) in the setup documentation for the minimum permissions required per feature.

Start the development server (watches `sqon`, `types`, `graphql-router`, and `search-server`):

```bash
npm run dev:server
```

Start component development (watches `types` and `components`):

```bash
npm run dev:components
```

---

## Tests

Run all module and app unit tests:

```bash
npm run test
```

Run the subset used during local development (excludes integration tests):

```bash
npm run test:dev
```

Run tests for a specific workspace:

```bash
npm run test -w modules/graphql-router
```

Integration tests require a running search engine:

```bash
make start
npm run test -w integration-tests/server
```

**Note:** always run tests from the monorepo root using `-w <workspace>` — never `cd` into a module. This matches the Jenkins pipeline behaviour.

---

## Working documents

The `.dev/` directory is the shared context layer for this project. It is the canonical record of planned work, known issues, and session history. It is read by developers, AI coding agents, and anyone onboarding to the project.

- [`.dev/roadmap.md`](.dev/roadmap.md) — planned features, architectural evolution, CI/CD phases. Items are open unless marked `[done]` or `[in progress]`.
- [`.dev/tech-debt.md`](.dev/tech-debt.md) — known issues and design weaknesses found during development. Entries marked `standalone: yes` can be picked up freely; others depend on roadmap work.
- [`.dev/sessions/`](.dev/sessions/) — one file per contributor per day (`YYYY-MM-DDTHHMMSS.md`), logging what was done each session, key decisions made, and open threads.

**Session discipline:** at the end of any meaningful work session, update these documents to reflect what changed. This keeps the documents useful for the next person (or agent) who picks up the work.
If working with an AI agent, this process will be done automatically by stating "we're done here" or similar (note: WIP).

---

## Using a custom search client

`arrangerRouter` accepts an optional `esClient` parameter. If you pass one in, Arranger skips its own client setup and uses yours directly. This is the right approach when you need connection behaviour Arranger does not configure itself - for example, AWS IAM authentication for Amazon OpenSearch Service.

**AWS example** (in your own server, not in Arranger):

```ts
import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import arrangerRouter from '@overture-stack/arranger-graphql-router';

const esClient = new Client({
  ...AwsSigv4Signer({
    region: 'us-east-1',
    service: 'es',              // 'es' for OpenSearch Service, 'aoss' for Serverless
    getCredentials: () => defaultProvider()(),
  }),
  node: 'https://your-cluster.us-east-1.es.amazonaws.com',
});

const router = await arrangerRouter({
  esClient,
  configs: {
    esIndex: 'your-index',
    documentType: 'YourType',
  },
});
```

`defaultProvider` resolves credentials from wherever they are available in the environment: the `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` env vars, an IAM role attached to the instance or container, a local `~/.aws` profile, and so on. It is part of the AWS SDK v3 (`@aws-sdk/credential-provider-node`) and is a dependency of your server, not of Arranger.

---

## AI coding tools

This project has first-class support for AI coding assistants. Agent instruction files at the root tell each tool about project conventions, working documents, and session discipline:

- [`CLAUDE.md`](CLAUDE.md) — Claude (Claude Code CLI and desktop)
- [`AGENTS.md`](AGENTS.md) — Codex and other general-purpose agents
- [`.github/copilot-instructions.md`](.github/copilot-instructions.md) — GitHub Copilot

All three cover the same ground with minor variations for tool-specific features. If you update project conventions, update all three.

**Start of session:** read `roadmap.md`, `tech-debt.md`, and the most recent file(s) in `.dev/sessions/` before starting work. The agent instruction files embed a checklist for this.

**End of session:** update the `.dev/` documents and extend today's file in `.dev/sessions/`. This is the handoff to the next session — whether that is you, a colleague, or an AI agent.
