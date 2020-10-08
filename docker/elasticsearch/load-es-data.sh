#!/bin/bash

set -euo pipefail

es_data_dir=$1
es_username=$2
es_password=$3

if [ ! -d $es_data_dir ]; then
	echo "The directory $es_data_dir does not exist"
	exit 1
fi

es_doc_dir=$es_data_dir/documents
es_index_config_file=$es_data_dir/index_config.json


es_basic_auth=$(echo -n "$es_username:$es_password" | base64)

echo "Creating file_centric_1.0 index"
curl -sL -XPUT \
	-H "Content-Type: application/json" \
	-H "Authorization: Basic $es_basic_auth" \
	http://localhost:9200/file_centric_1.0 \
	-d "@${es_index_config_file}"
echo""

for f in $es_doc_dir/*.json
do
	#echo "Loading document: $f"
	object_id=$(echo $f | sed 's/\.json//' | sed 's/.*\///g')

	curl -sL -XPUT \
		-H "Content-Type: application/json" \
		-H "Authorization: Basic $es_basic_auth" \
		http://localhost:9200/file_centric_1.0/_doc/$object_id \
		-d "@${f}"
	echo ""
done

