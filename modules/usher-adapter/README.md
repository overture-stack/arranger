# @overture-stack/arranger-usher-adapter

Applies Usher's access decisions to Arranger's GraphQL routers. The adapter translates: Usher's bridge decides what each request may reach, and the adapter turns each catalogue's enforcement result into that catalogue's server-side filter, deciding nothing itself.

Requires Node.js 24 or later, as the Usher packages do.

## Use

The search server image wires it when `ENABLE_ACCESS_CONTROL=true`. A host building its own GraphQL routers wires it the same way:

1. Create it once, with the bridge, each catalogue's registration and a logger: `createUsherAccessControl({ bridge, catalogues, logger })`.
2. Pass each catalogue's router `filterFor(catalogueId)` as its `getServerSideFilter`, and collect the mapping handed by each router to its `onIndexMapping` hook.
3. Call `verify(mappings)` once every router has loaded or failed, before the host listens. It checks each loaded catalogue's fields against its mapping, each a keyword outside any nested mapping, then registers every configured catalogue with the bridge in one call. A keyword sub-field of a multi-field, such as `study_id.keyword` declared under `fields` rather than `properties`, is not found, so startup refuses it: map the field itself as a keyword. A catalogue that failed to load is registered and never verified, so it serves nothing.
4. Mount the bridge's Express layer ahead of the routers, then start the bridge.

`createBridgeLogger({ write })` builds the one logger handed to both the bridge and the adapter, writing each event as one JSON line.

## What a request gets

| The bridge's result for the catalogue  | The router's filter                                |
| -------------------------------------- | -------------------------------------------------- |
| `narrow`                               | The result's filter, unchanged                     |
| `allow`                                | The router's allow-all value                       |
| `deny`, or no result for the catalogue | Nothing matches, on the catalogue's resource field |

A suspended principal, signed in but unconfirmed by the bridge, is served the open tier on searches and facets. Any other read is refused for now with `AccessControlUnavailableError`, carrying `UNAVAILABLE_ANSWER`, the bridge's own 503 text and wait. Network search is refused as a configuration failure for every principal, since access control does not serve it yet.

Each application of a result logs `access_control.permitted` or `access_control.denied` at info, and each refusal for now `access_control.unavailable` at warn, naming the catalogue, the read path, the request identifier and the principal's subject, never a token, payload or record.
