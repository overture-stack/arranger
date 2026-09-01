# Arranger's layers and their vocabulary

Arranger's code is layered, and each layer calls the same filter something different. This page says which layer owns what, what each one calls things, and which moves are planned to make the code match. Read it before moving code between modules, naming anything that touches filtering, or adding anything that depends on Usher.

## The layers

Listed from the bottom up. A layer may depend on the layers listed before it, never on those after it.

| Layer | Where it lives | Owns | Must not depend on |
|---|---|---|---|
| SQON | `modules/sqon` | The query language: shape, construction, validation, reduction | Any other Arranger package |
| Arranger logic | Inside `modules/graphql-router` (`buildQuery`, `buildAggregations`, mapping to the search engine) | Turning one SQON into a search engine query | Filtering, the Usher adapter, the GraphQL layer |
| Filtering | `modules/graphql-router/src/filtering/` (planned) | Composing the filter a search asked for with the deployment's constraint, and refusing a constraint that is absent or has no clauses | The Usher adapter, the GraphQL layer |
| Usher adapter | `modules/usher-adapter` (planned), published as `@overture-stack/arranger-usher-adapter` | Turning Usher grants into a constraint. Depends on the bridge, `@overture-stack/usher-express-bridge`, from the Usher repository | The router package, filtering |
| GraphQL layer | `modules/graphql-router`: schema, resolvers, Express routes | Per-request wiring: calling the deployment's callback and handing both filters to filtering | The Usher adapter |
| Server | `apps/search-server` | Reading the environment, mounting the bridge, wiring the adapter into `getServerSideFilter` | Nothing. It is where the other layers are wired together |

Filtering and the Usher adapter sit side by side, between Arranger logic and the GraphQL layer. Neither imports the other. The server passes the adapter's function to the router as `getServerSideFilter`, and the router passes what that returns to filtering.

**The server mounts the bridge above both of its catalogue branches.** `apps/search-server/src/arrangerRoutes.ts` mounts a single catalogue's router with no path prefix, and each of several catalogues under `/<catalogueId>`, in two separate branches. A bridge mounted inside one branch never runs for a deployment of the other shape, so it goes on the router before the branch.

**Arranger logic and the GraphQL layer share one package and cannot be separated yet.** The boundary between them already holds in behaviour. Every call to `compileFilter` comes from a resolver or from the download route, and nothing in `buildQuery` or `buildAggregations` calls it, so Arranger logic only ever receives a filter that is already composed.

**`modules/types` holds Arranger logic's types.** Despite its name it also ships runtime constants and helpers. Router and Express types belong with the router. Relocating the ones already in `modules/types` is separate work, and `GetServerSideFilterFn` is the only one this page plans for.

## Arranger runs without Usher, and the dependency direction guarantees it

- **Only `apps/search-server` depends on `usher-adapter`.** `modules/graphql-router`, `modules/types` and `modules/sqon` never list it in their `package.json`, which a grep can check.
- **A deployment with no Usher changes nothing below the server.** The server mounts no bridge, `getServerSideFilter` defaults to `getDefaultServerSideFilter`, which returns a constraint that excludes nothing, and every other layer runs exactly as it does with Usher.

**Name a module or directory for what always runs, not for who might call it.** The directory now called `accessControl/` fails that test. Every file in it is required by an Arranger with no access control at all: the default constraint, the `disableFilters` guard, the middleware registry holding that guard, and the test fixtures. "Access control" is reserved for what depends on Usher, which is `usher-adapter` alone.

## One filter, three vocabularies

| Layer | The filter a search asks for | The filter the deployment imposes | The value that excludes nothing |
|---|---|---|---|
| SQON | a SQON | a SQON | `SqonBuilder.matchEverything()` |
| Filtering | the requested filter | the constraint | a constraint that excludes nothing |
| GraphQL layer | `clientSideFilter` | the server-side filter: `getServerSideFilter`, `GetServerSideFilterFn` | `getDefaultServerSideFilter()` |

**"Server-side" and "client-side" are GraphQL-layer words.** They say who supplied a filter, and only the layer handling requests knows that. Below it, nothing is supplied by anyone. There are filters, and the rule that combines them.

**The SQON layer has no word for either role**, because to it both are SQONs. `matchEverything` names what the value matches, not what it is used for.

## Terms

- **Access control:** behaviour that depends on Usher. Only `usher-adapter` has any. Composing filters happens with or without Usher, so it is filtering and not access control.
- **Constraint:** the filter every search is intersected with, supplied by the deployment. A constraint can only narrow what a search returns, never widen it. `compileFilter` requires one on every call and refuses one with no clauses.
  **Its TSDoc has to say this outright.** The constraint used when nothing is configured matches every document, and a reader who meets that value first will take "constraint" to mean something that permits. It is still a constraint. It excludes nothing.
- **`matchEverything`:** the SQON matching every document, `not[ in _id [] ]`, which is the negation of `matchNothing('_id')`. It takes no field name, because the field has no effect: an empty value list matches nothing on any field, including one that a `nestingPrefix` has turned into a path that does not exist. It carries a leaf, so `reduceSqon` never prunes it down to an empty combination, and `compileFilter` accepts it where it refuses a leafless one. Its test must cover that the reducer leaves it intact: as a `SqonBuilder` value it is reduced on construction, which the router's hand-written literal never was.
  **It is the one value built to pass `compileFilter`'s guard, so reaching for it by mistake fails open.** The same mistake with `matchNothing` fails closed and gets noticed. Its TSDoc must say so, so that it does not read as `matchNothing`'s harmless twin.
- **`matchNothing`:** the SQON matching no document, `in <fieldName> []`. The encoding every deny must use.
- **Requested filter:** the filter a search asked for. The proposed name for `compileFilter`'s other input; not yet settled.
- **Server-side filter:** the GraphQL layer's name for the constraint, as the deployment supplies it. Correct in the router's API (`getServerSideFilter`, `getDefaultServerSideFilter`, `GetServerSideFilterFn`) and nowhere below it.

Words to avoid, and what to say instead:

| Avoid | Why | Say instead |
|---|---|---|
| allow-all | Reads as permitting, which contradicts "constraint" | `matchEverything`, or "a constraint that excludes nothing" |
| empty constraint | An empty combination is exactly what `compileFilter` refuses | "a constraint that excludes nothing" |
| matchAll | `SqonBuilder.all(fieldName, values)` already means "the field contains all of these values" | `matchEverything`, the opposite of `matchNothing` |
| sentinel, for this value | Names a property of `matchEverything` as though it were a second thing | `matchEverything`, stating the leaf property where it matters |

These apply to the filter only. Federated search's **sentinel bucket**, which a node contributes for a field it lacks, is a different thing and keeps its name.

## Planned moves

None of these has been made yet.

| Move | Visible to consumers |
|---|---|
| Rename `graphql-router/src/accessControl/` to `filtering/` | No. Reached only through the package's private `#accessControl/` imports |
| Move `compileFilter` from `mapping/utils/` into `filtering/` | No. Nothing in `mapping/` calls it |
| Rename `enforceAccessControl` to `enforceFilterPolicy` | No. Internal |
| Add `SqonBuilder.matchEverything()`, and make `getDefaultServerSideFilter` a wrapper returning it | No. Additive in `sqon`, and the router's published name is unchanged |
| Rename `compileFilter`'s parameters to the filtering vocabulary | No. Internal, and marked with a TODO in the file |
| Move `GetServerSideFilterFn` from `modules/types` to the router | **Yes**, for anyone importing it from `@overture-stack/arranger-types/configs` |
| Create `modules/usher-adapter` | No. Additive |

**Moving `GetServerSideFilterFn` is two moves, not one.** `ConfigsObject` in `modules/types/src/configs/index.ts` declares a `getServerSideFilter` property typed with it. `modules/types` cannot import from the router, because the router imports from `modules/types`. So the property leaves `ConfigsObject` along with the type, and the router adds it back on its own configuration type. `apps/search-server/src/configs/types/index.ts` already imports from both packages, so its change is moving one name from one import to the other. If the renames above leave nothing using the type, the move becomes a removal. The same file types the callback `GetServerSideFilterFn<any>` and names the property `filters`, where the router calls it `getServerSideFilter`, so the move is also the moment to align both.

**`compileFilter`'s error messages keep the GraphQL layer's vocabulary on purpose.** Their reader is a deployment author, who can only fix the problem through `getServerSideFilter`. That is harmless while filtering lives inside `graphql-router`. When the layers separate, those messages are where filtering's terms get translated into the router's.

## Sequencing

- **The `filtering/` consolidation and `matchEverything` do not depend on the package manager**, and can land at any time.
- **Create `modules/usher-adapter` after the pnpm migration** ([roadmap §3.3](../../roadmap.md#33-migrate-from-npm-to-pnpm)). Otherwise its manifest is written once with `file:` dependencies and rewritten with `workspace:` ones.
- **`usher-express-bridge` has to be published before `usher-adapter` can build in CI.** Every other workspace dependency in this repository is a sibling inside it. The bridge lives in the Usher repository, and the Jenkins build cannot resolve a path outside its own checkout.

Related: [Arranger auth](../arranger-auth/index.md) for the enforcement seam's design, and [pnpm migration: scoping findings](pnpm-migration.md).
