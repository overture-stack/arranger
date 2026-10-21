# @overture-stack/arranger-usher-adapter

Applies Usher's access decisions to Arranger's GraphQL routers. The adapter translates: Usher's bridge decides what each request may reach, and the adapter turns each catalogue's enforcement result into that catalogue's server-side filter, deciding nothing itself.

Requires Node.js 24 or later, as the Usher packages do.

## Use

The search server image wires it when `ENABLE_ACCESS_CONTROL=true`. A host building its own GraphQL routers wires it the same way:

1. Create it once, with the bridge, each catalogue's registration and a logger: `createUsherAccessControl({ bridge, catalogues, logger })`.
2. Pass each catalogue's router `filterFor(catalogueId)` as its `getServerSideFilter`, and collect what each router hands its `onIndexMapping` hook: the index mapping and the index probe, kept together as that catalogue's `CatalogueIndex`, `{ mapping, probe }`.
3. Await `verify(indices)` once every router has loaded or failed, before the host listens. It checks each loaded catalogue as [What startup checks](#what-startup-checks) describes, then registers every configured catalogue with the bridge in one call. A catalogue that failed to load is registered and never verified, so it serves nothing.
4. Mount the bridge's Express layer ahead of the routers, then start the bridge. On shutdown, await the bridge's `stop()`.

## What startup checks

Each catalogue's registration defines its categories as conditions: `categories.global` maps each global category Usher defines to the SQON condition a record meets to carry it, `categories.resource` maps a resource to its own categories, and `absentCategories` names the global categories no record of the catalogue can carry. `verify` checks each loaded catalogue in three steps, each running only once the one before it passed for that catalogue:

| Step                 | Refuses startup when                                                                                                                                                                                                                                                                                                                                                                                                                    | Each reason names                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1. The registration  | It breaks a rule of Usher's registration format, such as a condition outside the category grammar or a category both defined and declared absent                                                                                                                                                                                                                                                                                        | The catalogue, the rule, and where in the registration             |
| 2. The index mapping | The resource field is not a keyword, a multi-field's keyword sub-field included, or lies inside a nested mapping; a field a condition reads is absent, nested, or not a keyword, date or numeric field; a date field names a format other than `strict_date_optional_time`, `date_optional_time` and `epoch_millis`; a value is not in its field's form, or a date `between` lists its later bound first; or the key is an artifact key | The catalogue, the category and the field                          |
| 3. The index         | Some record holds more than one value in the resource field; the engine refuses a condition's query; or the engine fails to answer any of these checks                                                                                                                                                                                                                                                                                  | The catalogue, and the field and how many records, or the category |

In step 3, every condition is validated by the engine and then counted, a resource's own category within that resource alone. A category declared absent holds no condition and is not checked. Every reason found, across every catalogue, is reported in one refusal, and none holds a value from a condition or a record.

Three events are logged through the adapter's logger beside the checks:

| Event                                       | Level | Logged when                                                                    | Fields                                                                                                           |
| ------------------------------------------- | ----- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `access_control.condition_refused`          | error | The engine refuses a condition's query, once per condition, beside the refusal | `catalogue`, `category`, `explanation`, and `resourceId` for a resource's own category                           |
| `access_control.startup_check_failed`       | error | The engine fails to answer a check, once per check, beside the refusal         | `catalogue`, `check`, `cause`, and the `field`, or the `category` and `resourceId` for a resource's own category |
| `access_control.category_matches_no_record` | warn  | A condition matches no record; startup proceeds                                | `catalogue`, `category`, and `resourceId` for a resource's own category                                          |

`explanation` and `cause` hold the engine's own text, which can quote a value, so they stay in the server's log: the refusal names only the catalogue and the field or category.

The search engine role Arranger uses needs, on each catalogue's index:

- `indices:admin/validate/query`, to validate each condition;
- search, to count records;
- inline Painless scripts allowed, to count the records holding more than one value in the resource field.

The bridge's `filterClauseLimit`, which the search server sets from `ACCESS_CONTROL_FILTER_CLAUSE_LIMIT`, is raised only together with the engine's `indices.query.bool.max_clause_count`, and never above it. The bridge weighs a filter so the engine's limit binds no earlier than its own, so a filter too large is denied with the bridge's reason, `filter-limit`, before the engine would fail the query. The bridge can deny a filter the engine would have run.

`createBridgeLogger({ write })` builds the one logger handed to both the bridge and the adapter, writing each event as one JSON line.

## What a request gets

| The bridge's result for the catalogue  | The router's filter                                |
| -------------------------------------- | -------------------------------------------------- |
| `narrow`                               | The result's filter, unchanged                     |
| `allow`                                | The router's allow-all value                       |
| `deny`, or no result for the catalogue | Nothing matches, on the catalogue's resource field |

A suspended principal, signed in but unconfirmed by the bridge, is served the open tier on searches and facets. Any other read is refused for now with `AccessControlUnavailableError`, carrying `UNAVAILABLE_ANSWER`, the bridge's own 503 text and wait: the GraphQL router logs the text and answers its own fixed text, `ACCESS_CONTROL_UNAVAILABLE_MESSAGE`, with the wait as `Retry-After`. Network search is refused as a configuration failure for every principal, since access control does not serve it yet.

Every deny reason the bridge gives, `filter-limit`, `no-grants`, `rendering-mismatch`, `unknown-resource` and `unmapped-category`, matches nothing in the same way.

Each application of a result logs `access_control.permitted` or `access_control.denied` at info, the latter with the deny's reason, and each refusal `access_control.unavailable` at warn, naming the catalogue, the read path, the request identifier and the principal's subject, never a token, payload or record.
