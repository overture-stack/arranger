#!/bin/sh
ES_HOST_CLEAN=$(echo "${ES_HOST}" | sed 's|/$||')

# Returns the human-readable engine label. When SEARCH_ENGINE is not set,
# probes GET / to detect the engine - mirrors Arranger's Stage 1 detection.
# Must be called after the cluster is ready. Requires cluster:monitor/main.
engine_label() {
    case "${SEARCH_ENGINE}" in
        opensearch)    echo "OpenSearch" ;;
        elasticsearch) echo "Elasticsearch" ;;
        *)
            if curl -k -s -u "${ES_USER}:${ES_PASS}" "${ES_HOST_CLEAN}/" | grep -q '"distribution".*"opensearch"'; then
                echo "OpenSearch"
            else
                echo "Elasticsearch"
            fi
            ;;
    esac
}

echo "⏳ Waiting for ${SEARCH_ENGINE:-Search Engine} at ${ES_HOST_CLEAN}..."

# Wait until the cluster responds with a 2xx from /_cluster/health.
# wait_for_status=yellow makes the cluster hold the response until it is
# at least yellow (or the 100s timeout passes), so this also gates on
# cluster readiness, not just TCP connectivity.
if ! ./scripts/retry-command.sh "curl -k -s -o /dev/null -w '%{http_code}' -u \"${ES_USER}:${ES_PASS}\" \"${ES_HOST_CLEAN}/_cluster/health?wait_for_status=yellow&timeout=100s&wait_for_no_initializing_shards=true\" | grep -q '^2'"; then
    echo "❌ ${SEARCH_ENGINE:-Search Engine} is unreachable after all retries. Aborting."
    exit 1
fi

ENGINE_LABEL=$(engine_label)

HEALTH_RESPONSE=$(curl -k -s -w "\n%{http_code}" -u "${ES_USER}:${ES_PASS}" "${ES_HOST_CLEAN}/_cluster/health")
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | sed '$d')
HEALTH_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)

printf "\n------------------------------------\n"
printf " %s Ready\n" "$ENGINE_LABEL"
printf "------------------------------------\n"

if [ "$HEALTH_CODE" = "200" ]; then
    CLUSTER=$(echo "$HEALTH_BODY" | grep -o '"cluster_name":"[^"]*"' | cut -d'"' -f4)
    STATUS=$(echo "$HEALTH_BODY"  | grep -o '"status":"[^"]*"'       | cut -d'"' -f4)
    NODES=$(echo "$HEALTH_BODY"   | grep -o '"number_of_nodes":[0-9]*' | cut -d':' -f2)
    SHARDS=$(echo "$HEALTH_BODY"  | grep -o '"active_shards":[0-9]*'   | cut -d':' -f2)

    case "$STATUS" in
        green)  ICON="✅" ;;
        yellow) ICON="⚠️ " ;;
        red)    ICON="❌" ;;
        *)      ICON="❓" ;;
    esac

    printf " Cluster : %s\n" "$CLUSTER"
    printf " Status  : %s %s\n" "$ICON" "$STATUS"
    printf " Nodes   : %s\n" "$NODES"
    printf " Shards  : %s\n" "$SHARDS"
else
    printf " Status  : ⚠️  health data unavailable (HTTP %s; grant cluster:monitor/health to see this)\n" "$HEALTH_CODE"
fi

printf "\n"
exit 0
