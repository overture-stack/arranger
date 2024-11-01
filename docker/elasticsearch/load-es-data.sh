#!/bin/bash

set -euo pipefail

es_user=$1
es_pass=$2
es_host=$3
es_index=$4
es_data_dir=$5
es_doc_dir=${6:-${es_data_dir}/documents}

if [ ! -d $es_data_dir ]; then
	echo "The directory $es_data_dir does not exist"
	exit 1
fi

es_index_config_file=$es_data_dir/index_config.json

es_basic_auth=$(printf "$es_user:$es_pass" | base64)

echo "Creating ${es_index} index"
curl -sL -XPUT \
	-H "Content-Type: application/json" \
	-H "Authorization: Basic $es_basic_auth" \
	"${es_host}/${es_index}" \
	-d "@${es_index_config_file}"
echo""

for f in $es_doc_dir/*.json
do
	#echo "Loading document: $f"
	object_id=$(echo $f | sed 's/\.json//' | sed 's/.*\///g')

	curl -sL -XPUT \
		-H "Content-Type: application/json" \
		-H "Authorization: Basic $es_basic_auth" \
		"${es_host}/${es_index}/_doc/$object_id" \
		-d "@${f}"
	echo ""
done

