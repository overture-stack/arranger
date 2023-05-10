.PHONY:

# Required System files
CURL_EXE := $(shell which curl)
DOCKER_COMPOSE_EXE := $(shell which docker-compose)
ROOT_DIR := $(shell dirname $(realpath $(lastword $(MAKEFILE_LIST))))


# STDOUT Formatting
BLUE := $$(echo "\033[0;34m")
GREEN := $$(echo "\033[0;32m")
MAGENTA := $$(echo "\033[0;35m")
RED := $$(echo  "\033[0;31m")
YELLOW := $$(echo "\033[0;33m")

END := $$(echo  "\033[0m")
ERROR_HEADER :=  [ERROR]:
INFO_HEADER := "**************** "

DONE_MESSAGE := $(YELLOW)$(INFO_HEADER) "- done\n" $(END)


# Variables
DOCKER_DIR := $(ROOT_DIR)/docker
DOCS_DIR := $(ROOT_DIR)/elasticsearch
ES_DATA_DIR := $(DOCKER_DIR)/elasticsearch
ES_HOST := http://localhost:9200
ES_INDEX := file_centric_1.0
ES_LOAD_SCRIPT := $(ES_DATA_DIR)/load-es-data.sh
ES_PASS := myelasticpassword
ES_USER := elastic
RETRY_CMD := $(ROOT_DIR)/scripts/retry-command.sh

ES_BASIC_AUTH := $(shell printf "$(ES_USER):$(ES_PASS)" | base64)


# Commands
DOCKER_COMPOSE_CMD := \
  ES_USER=$(ES_USER) \
	ES_PASS=$(ES_PASS) \
  $(DOCKER_COMPOSE_EXE) -f \
	$(ROOT_DIR)/docker-compose.yml
DC_UP_CMD := COMPOSE_DOCKER_CLI_BUILD=1 DOCKER_BUILDKIT=1 $(DOCKER_COMPOSE_CMD) up -d --build


#############################################################
# Internal Targets
#############################################################
_ping_elasticsearch_server:
	@echo $(YELLOW)$(INFO_HEADER) "Pinging ElasticSearch on $(ES_HOST)" $(END)
	@sh $(RETRY_CMD) "curl --retry 10 \
    --retry-delay 0 \
    --retry-max-time 40 \
    --retry-connrefuse \
	-H \"Authorization: Basic $(ES_BASIC_AUTH)\" \
	\"$(ES_HOST)/_cluster/health?wait_for_status=yellow&timeout=100s&wait_for_no_initializing_shards=true\""
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
		-X GET "$(ES_HOST)/_cat/indices" \
		| grep -v kibana \
		| grep -v arranger \
		| grep -v configuration \
		| awk '{ print $$3 }' \
		| xargs -I {} $(CURL_EXE) -H "Authorization: Basic $(ES_BASIC_AUTH)" -X DELETE "$(ES_HOST)/{}?pretty"

	@echo $(GREEN)$(INFO_HEADER) "ElasticSearch indices removed" $(END)

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
		"$(ES_HOST)/_cat/indices" \
		| grep -v kibana \
		| grep -v arranger \
		| grep -v configuration \
		| awk '{ print $$3 }'  \
		| sed 's#^#$(ES_HOST)/#' \
		| sed 's#$$#/_delete_by_query#' \
		| xargs $(CURL_EXE) -XPOST \
		-H "Authorization: Basic $(ES_BASIC_AUTH)" \
		-H 'Content-Type: application/json' \
		-d '{"query":{"match_all":{}}}'

seed-es:
	@echo $(YELLOW)$(INFO_HEADER) "Initializing file_centric index" $(END)
	@$(ES_LOAD_SCRIPT) $(DOCS_DIR) $(ES_USER) $(ES_PASS) $(ES_HOST) $(ES_INDEX)

get-es-indices:
	@echo $(YELLOW)$(INFO_HEADER) "Available indices:" $(END)
	@$(CURL_EXE) -X GET -H "Authorization: Basic $(ES_BASIC_AUTH)"  "$(ES_HOST)/_cat/indices"

get-es-filecentric-content:
	@echo $(YELLOW)$(INFO_HEADER) "file_centric content:" $(END)
	@$(CURL_EXE) -X GET -H "Authorization: Basic $(ES_BASIC_AUTH)"  "$(ES_HOST)/file_centric/_search?size=100" | ${JQ_EXE} -e

get-es-info: get-es-indices get-es-filecentric-content

#############################################################
#  Docker targets
#############################################################
ps:
	@echo $(YELLOW)$(INFO_HEADER) "Showing running services" $(END)
	@$(DOCKER_COMPOSE_CMD) ps

start:
	@echo $(YELLOW)$(INFO_HEADER) "Starting the following services: Elasticsearch, Kibana, and Arranger Server" $(END)
	@$(DC_UP_CMD)
	@echo $(GREEN)$(INFO_HEADER) Succesfully started all Arranger services! $(GREEN)
	@echo $(MAGENTA) "You may have to populate ES and restart the Server container. (Use 'make seed-es' for mock data)" $(END)

start-es:
	@echo $(YELLOW)$(INFO_HEADER) "Starting the following service: Elasticsearch" $(END)
	@COMPOSE_PROJECT_NAME=Arranger_ES $(DC_UP_CMD) elasticsearch
	@echo $(GREEN)$(INFO_HEADER) Succesfully started this service! $(GREEN)
	@echo $(MAGENTA) "You may have to populate it before using it with the Server. (Use 'make seed-es' for mock data)" $(END)

start-server:
	@echo $(YELLOW)$(INFO_HEADER) "Starting the following service: Arranger Server" $(END)
	@COMPOSE_PROJECT_NAME=Arranger_SERVER $(DC_UP_CMD) arranger-server
	@echo $(GREEN)$(INFO_HEADER) Succesfully started this service! $(GREEN)

test:
	@echo $(YELLOW)$(INFO_HEADER) "Testing all services and integrations" $(END)
	@ES_USER=$(ES_USER) ES_PASS=$(ES_PASS) npm run test
	@echo $(GREEN)$(INFO_HEADER) Finished testing! $(GREEN)

#############################################################
#  Dev targets
#############################################################
format:
	@./scripts/format-all.sh
