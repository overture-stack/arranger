#!/bin/sh
ES_HOST_CLEAN=$(echo "${ES_HOST}" | sed 's|/$||')

echo "⏳ Waiting for Elasticsearch at ${ES_HOST_CLEAN}..."

./scripts/retry-command.sh "curl -k -s -u \"${ES_USER}:${ES_PASS}\" \"${ES_HOST_CLEAN}/_cluster/health?wait_for_status=yellow&timeout=100s&wait_for_no_initializing_shards=true\" > /dev/null"

# ➕ Check if retry script succeeded, bail out if not
if [ $? -ne 0 ]; then
    echo "❌ Elasticsearch is unreachable after all retries. Aborting."
    exit 1
fi

HEALTH=$(curl -k -s -u "${ES_USER}:${ES_PASS}" "${ES_HOST_CLEAN}/_cluster/health")

CLUSTER=$(echo "$HEALTH" | grep -o '"cluster_name":"[^"]*"' | cut -d'"' -f4)
STATUS=$(echo "$HEALTH"  | grep -o '"status":"[^"]*"'       | cut -d'"' -f4)
NODES=$(echo "$HEALTH"   | grep -o '"number_of_nodes":[0-9]*' | cut -d':' -f2)
SHARDS=$(echo "$HEALTH"  | grep -o '"active_shards":[0-9]*'   | cut -d':' -f2)

case "$STATUS" in
    green)  ICON="✅" ;;
    yellow) ICON="⚠️ " ;;
    red)    ICON="❌" ;;
    *)      ICON="❓" ;;
esac

printf "\n------------------------------------\n"
printf " Elasticsearch Ready\n"
printf "------------------------------------\n"
printf " Cluster : %s\n" "$CLUSTER"
printf " Status  : %s %s\n" "$ICON" "$STATUS"
printf " Nodes   : %s\n" "$NODES"
printf " Shards  : %s\n" "$SHARDS"
printf "\n"

exit 0

