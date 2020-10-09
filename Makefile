.PHONY:

# Required System files
DOCKER_COMPOSE_EXE := $(shell which docker-compose)
CURL_EXE := $(shell which curl)

# STDOUT Formatting
RED := $$(echo  "\033[0;31m")
YELLOW := $$(echo "\033[0;33m")
END := $$(echo  "\033[0m")
ERROR_HEADER :=  [ERROR]:
INFO_HEADER := "**************** "
DONE_MESSAGE := $(YELLOW)$(INFO_HEADER) "- done\n" $(END)

# Variables
ROOT_DIR := $(shell dirname $(realpath $(lastword $(MAKEFILE_LIST))))
RETRY_CMD := $(ROOT_DIR)/scripts/retry-command.sh
PROJECT_NAME := $(shell echo $(ROOT_DIR) | sed 's/.*\///g')
DOCKER_DIR := $(ROOT_DIR)/docker
ES_DATA_DIR := $(DOCKER_DIR)/elasticsearch
ES_LOAD_SCRIPT := $(ES_DATA_DIR)/load-es-data.sh
ES_USERNAME := elastic
ES_PASSWORD := myelasticpassword
ES_BASIC_AUTH := $(shell echo -n "$(ES_USERNAME):$(ES_PASSWORD)" | base64)

# Commands
DOCKER_COMPOSE_CMD := ES_USERNAME=$(ES_USERNAME) ES_PASSWORD=$(ES_PASSWORD) $(DOCKER_COMPOSE_EXE) -f $(ROOT_DIR)/docker-compose.yml
DC_UP_CMD := $(DOCKER_COMPOSE_CMD) up -d --build

#############################################################
# Internal Targets
#############################################################
_ping_elasticsearch_server:
	@echo $(YELLOW)$(INFO_HEADER) "Pinging ElasticSearch on http://localhost:9200" $(END)
	@$(RETRY_CMD) "curl --retry 10 \
    --retry-delay 0 \
    --retry-max-time 40 \
    --retry-connrefuse \
	-H \"Authorization: Basic $(ES_BASIC_AUTH)\" \
	\"http://localhost:9200/_cluster/health?wait_for_status=yellow&timeout=100s&wait_for_no_initializing_shards=true\""
	@echo ""


#############################################################
# Help
#############################################################

# Help menu, displaying all available targets
help:
	@echo
	@echo "**************************************************************"
	@echo "**************************************************************"
	@echo "To dry-execute a target run: make -n <target> "
	@echo
	@echo "Available Targets: "
	@grep '^[A-Za-z][A-Za-z0-9_-]\+:.*' $(ROOT_DIR)/Makefile | sed 's/:.*//' | sed 's/^/\t/'
	@echo


#############################################################
#  Cleaning targets
#############################################################

# Kills running services and removes created files/directories
clean-docker:
	@echo $(YELLOW)$(INFO_HEADER) "Destroying running docker services" $(END)
	@$(DOCKER_COMPOSE_CMD) down -v
	
# Destroy all non-arranger and non-kibana elasticsearch indices
clean-elastic:
	@echo $(YELLOW)$(INFO_HEADER) "Removing ElasticSearch indices" $(END)
	@$(CURL_EXE) \
		-H "Authorization: Basic $(ES_BASIC_AUTH)" \
		-X GET "http://localhost:9200/_cat/indices" \
		| grep -v kibana \
		| grep -v arranger \
		| grep -v configuration \
		| awk '{ print $$3 }' \
		| xargs -i $(CURL_EXE) -H "Authorization: Basic $(ES_BASIC_AUTH)" -XDELETE "http://localhost:9200/{}?pretty"

	@echo $(YELLOW)$(INFO_HEADER) "ElasticSearch indices removed" $(END)

clean-log-dirs:
	@echo $(YELLOW)$(INFO_HEADER) "Cleaning log directories" $(END);
	@rm -rf $(OUTPUT_DIRS)

clean-output-dirs:
	@echo $(YELLOW)$(INFO_HEADER) "Cleaning output directories" $(END);
	@rm -rf $(LOG_DIRS)

# Clean everything. Kills all services, maven cleans and removes generated files/directories
clean: clean-elastic clean-docker

#############################################################
#  Indexing and ES Targets
#############################################################
# Just delete the documents, not the entire index.
clear-es-documents:
	@echo $(YELLOW)$(INFO_HEADER) "Deleting elasticsearch documents" $(END)
	@$(CURL_EXE) -s -X GET \
		-H "Authorization: Basic $(ES_BASIC_AUTH)" \
		"http://localhost:9200/_cat/indices" \
		| grep -v kibana \
		| grep -v arranger \
		| grep -v configuration \
		| awk '{ print $$3 }'  \
		| sed  's/^/http:\/\/localhost:9200\//' \
		| sed 's/$$/\/_delete_by_query/' \
		| xargs $(CURL_EXE) -XPOST -H "Authorization: Basic $(ES_BASIC_AUTH)" --header 'Content-Type: application/json' -d '{"query":{"match_all":{}}}'

init-es:
	@echo $(YELLOW)$(INFO_HEADER) "Initializing file_centric index" $(END)
	@$(ES_LOAD_SCRIPT) $(ES_DATA_DIR) $(ES_USERNAME) $(ES_PASSWORD)


get-es-indices:
	@echo $(YELLOW)$(INFO_HEADER) "Available indices:" $(END)
	@$(CURL_EXE) -X GET -H "Authorization: Basic $(ES_BASIC_AUTH)"  "localhost:9200/_cat/indices"

get-es-filecentric-content:
	@echo $(YELLOW)$(INFO_HEADER) "file_centric content:" $(END)
	@$(CURL_EXE) -X GET -H "Authorization: Basic $(ES_BASIC_AUTH)"  "localhost:9200/file_centric/_search?size=100" | ${JQ_EXE} -e

get-es-info: get-es-indices get-es-filecentric-content

#############################################################
#  Docker targets
#############################################################
ps:
	@echo $(YELLOW)$(INFO_HEADER) "Showing running services" $(END)
	@$(DOCKER_COMPOSE_CMD) ps

start:
	@echo $(YELLOW)$(INFO_HEADER) "Starting the following services: elasticsearc, kibana, arranger-server, and arranger-ui" $(END)
	@$(DC_UP_CMD)
	@$(MAKE) _ping_elasticsearch_server
	@echo $(YELLOW)$(INFO_HEADER) Succesfully started all arranger services! $(END)

#############################################################
#  Dev targets
#############################################################
format:
	@./scripts/format-all.sh
