# Decoupling the startup health check from the application credential

Detail layer for the corresponding [`.dev/roadmap.md`](../../../roadmap.md) entry. The roadmap carries what each item is and where it stands; this file holds the justification, alternatives considered, prior art, and history. Extracted verbatim 2026-08-18 under `roadmap_split: yes`.

---

## Decouple startup health check from application credential

`scripts/ping-elasticsearch.sh` calls `GET /_cluster/health` using the application user's credentials (`ES_USER`/`ES_PASS`). This forces `cluster:monitor/health` to be granted to the application role even though no application code path ever calls `/_cluster/health`. The permission exists solely so a shell script can display a status block on startup.

This violates the principle of least privilege: the application user's role carries a permission it never exercises. Any operator following the documented minimum permissions will grant `cluster:monitor/health` to their search engine user indefinitely, with no indication that it is a startup-script concern rather than an application requirement.

**Correct fix:**

Move the readiness gate into a Kubernetes init container that runs with its own, more privileged credential, separate from the application's runtime credential:

- **Init container:** runs `ping-elasticsearch.sh` (or its successor) with an elevated credential granted `cluster:monitor/main` + `cluster:monitor/health`. It retries `GET /_cluster/health?wait_for_status=yellow&...` until the cluster is ready or the container times out, gating the pod's main container start via the normal init-container mechanism. The cluster status block (cluster name, status, node count, shards) stays as this container's log output, visible via `kubectl logs <pod> -c <init-name>`, and never needs to be a concern for the app container.
- **Main container:** the application runs with a leaner credential, `cluster:monitor/main` only, which is all it needs for `GET /` engine auto-detection. It never holds `cluster:monitor/health`.

This preserves the `wait_for_status=yellow` readiness gate (true cluster-ready signal, not just HTTP connectivity) while still removing the unused permission from the long-running application process: the actual least-privilege violation the rest of this item is about.

A simpler alternative (drop the readiness gate, probe `GET /` only, no init container) was considered and rejected: it trades a real readiness check for a permissions fix, and `GET /` only confirms the process is responding, not that shards are allocated.

**Related:** the script filename (`ping-elasticsearch.sh`) and env var names (`ES_HOST`, `ES_USER`, `ES_PASS`) are also Elasticsearch-first and should be renamed in the same effort. See tech-debt: "Elasticsearch-first naming in startup script and env vars".

_Standalone: yes, once the approach is agreed. Needs a new Vault role/policy for the init container's elevated credential, a second VSO-injected secret, and an `initContainers` stanza added to the Helm chart, in addition to script changes. If the Helm chart lives in a separate repo from this one, that work belongs there. No application logic changes._
