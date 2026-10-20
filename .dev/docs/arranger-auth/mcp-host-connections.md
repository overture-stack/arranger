# MCP host: connection authentication

This document describes the MCP host app, not Arranger. It is drafted here because the host's design conversation currently lives alongside Arranger's. It moves with the host app to its own repo once that exists, unchanged in scope.

This file covers each connection's authentication from the host's side. The delegated-access contract any Usher-protected application's client (this host, a portal backend, a pipeline) has to meet is its own: see `delegated-access.md` in Usher's corpus.

Skeleton only, sections to be filled in. Each section below marks whether it names a developer decision or settled mechanism to check against existing design docs.

## 1. The chain today

Person → host → `apps/mcp-server` → search server (bridge and Usher adapter) → Usher's controller.

`apps/mcp-server` calls the search server over plain HTTP with no credential today. It is a client of an Usher-protected application, the same as any other, not an enforcement point itself. Enforcement stays where the Usher adapter work already puts it, at the search server.

## 2. Principal and actor

A request made for a person is decided by that person's grants alone; the client never gains access by acting for someone, and a client reading for nobody is a service account with grants of its own (`delegated-access.md`'s rule A). **Decided 2026-10-08:** the host never reads Overture data as itself. Every read is for a signed-in person, or anonymous and limited to open data; the host holds no grants of its own.

## 3. Identity propagation to Arranger-backed servers

The MCP authorization spec forbids token passthrough: a token issued for the MCP server must not be forwarded to whatever it calls downstream. Token exchange at the identity provider (RFC 8693, which Keycloak supports as Standard token exchange, on by default from Keycloak 26.2) is the pattern: `apps/mcp-server` exchanges the person's token for one whose audience is the search server. Keycloak performs this exchange only when the original token's audience already names the requester, and the requester must be a confidential client with Standard token exchange enabled. Standard exchange does not add an `act` claim: the exchanged token's `azp` names the requesting client instead, and Usher records `azp` as the actor, which is how §2's trail is produced. An `act` claim appears only where the identity provider adds one, for Keycloak its delegation feature, still a preview. The threat token exchange defends against: a token stolen at one hop replayed at another. Usher's own Decide B, that the controller accepts a sign-in token only when its audience names the application presenting it, would make this fail closed at Usher's own controller too, not only by the spec's convention, but that rule is still pending the developer.

The host is a desktop app ([MCP Host Plan](../mcp-host/mcp-host-plan.md) §2.4), so it signs in as an OAuth public client, with PKCE and no client secret. The exchange above is unaffected: `apps/mcp-server` is the confidential client that requests it. Every installed copy of the app shares one `clientId`, so `clientId` alone identifies the app, never the person.

## 4. Third-party connections (cBioPortal-shaped)

Per-person tokens the host holds on the user's behalf, for a connection to something outside Overture entirely, with consent, storage, refresh, and revocation to design. Firm rule, not negotiable per-connection: an Overture token never reaches a third party, and a third party's token never reaches Overture.

**cBioPortal, as checked on 2026-10-09.** Its hosted MCP servers, the database server at `https://mcp.cbioportal.org/db/mcp` and the navigator at `https://mcp.cbioportal.org/navigator/mcp`, require sign-in. The database server publishes protected-resource metadata, as the MCP authorization specification asks, naming cBioPortal's own authorization server, `https://mcp.cbioportal.org/`, which signs people in with Google, its only provider so far. A token it issues is valid at cBioPortal's servers alone.

The host's first connection for a person, traced:

1. The host calls the MCP server without a cBioPortal token, and receives a 401 pointing at its metadata.
2. The host reads the metadata and finds cBioPortal's authorization server.
3. The host registers itself there as a client, automatically, on first contact.
4. The person signs in through the browser with Google, and approves.
5. cBioPortal's authorization server issues a token for its MCP server, and the host stores it under the person's host account.
6. Later cBioPortal calls carry that token, and Overture calls carry the person's Overture tokens. Neither is ever sent in place of the other.

Neither Usher nor Keycloak takes part. Usher governs Overture's data and accepts no outside token, and Keycloak signs the person in to Overture alone. Keycloak could offer Google as a way to sign in to Overture too, a convenience that still leaves two sign-ins and two tokens, since cBioPortal accepts only its own authorization server's tokens.

What the host needs for it: discovery, automatic client registration, the browser sign-in with PKCE, encrypted per-person token storage, refresh, and a way for the person to disconnect. cBioPortal records the person's Google email and account ID on every tool call, so connecting also tells cBioPortal who asked what; see §6.

Sources: [cBioPortal MCP documentation](https://docs.cbioportal.org/ai-integrations/mcp/), [the database server's discovery document](https://mcp.cbioportal.org/.well-known/oauth-protected-resource/db/mcp).

## 5. A remote or separate Usher instance

Token-level trust between two Usher instances is the federation question, and it hasn't been decided yet (network search is itself refused under access control until that lands). Until it does, this plan treats a remote Usher-governed server exactly like any other external OAuth resource under §4: its own sign-in, its own identity provider, no assumed trust with the host's own Usher instance. **Developer decision:** the federation posture, when it's time to revisit this section.

## 6. Data crossing connections within one chat session

The item to settle first, placed last here only because it depends on §1 to state precisely. Once a controlled record enters the model's context from one connection, a later tool call to a _different_ connection can carry it out as an argument, with a third-party server's own (possibly untrusted) response as the likely injection point. The same opening runs the other way: injected instructions in a third party's answer can make the host read _more_ Overture data with the person's authority than was actually asked for, a confused deputy rather than an exfiltration. The rule has to govern what the model may call after reading untrusted content, in both directions. Usher's guarantee ends at its applications' own answers, the same limit already stated for exports; it does not follow the data past that boundary into a model's context. Relevant given iMicroSeq's Indigenous data is explicitly in scope for this host. Options to weigh, not yet a mechanism decision: refuse external tool calls once a session has read controlled data, require explicit per-call confirmation before data leaves a connection, or scope sessions so a controlled-data connection and an external one are never live together. **Developer decision.**

## Open questions

- §5 and §6 are the developer's to decide; §2 is decided (2026-10-08).
- §3 and §4 are closer to settled mechanism (token exchange, per-person third-party tokens with the no-crossover rule); check them against `delegated-access.md` rather than re-deciding them here.
- None of this blocks or reorders the Usher adapter's own work; `apps/mcp-server` sits downstream of that seam, not on its path.
