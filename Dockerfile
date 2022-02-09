ARG APP_FOLDER=/app
ARG APP_GID=1000
ARG APP_UID=1000
ARG APP_USER=node
ARG ES_HOST=http://localhost:9200

#######################################################
# Builder
#######################################################
FROM node:16-alpine as builder

ARG APP_FOLDER
ARG APP_GID
ARG APP_UID
ARG APP_USER

RUN apk --no-cache add curl g++ make python3 shadow \
	&& groupmod -g $APP_GID $APP_USER \
	&& usermod -u $APP_UID -g $APP_GID $APP_USER

WORKDIR $APP_FOLDER

COPY . .
RUN chown -R $APP_USER $APP_FOLDER

USER $APP_USER

RUN npm ci \
	&& npm config set unsafe-perm true \
	&& npm run bootstrap

#######################################################
# Arranger Server
#######################################################
FROM builder as server

ARG APP_FOLDER
ARG APP_USER

WORKDIR $APP_FOLDER

USER $APP_USER

EXPOSE 5050

CMD make _ping_elasticsearch_server -e && BABEL_DISABLE_CACHE=1 npm run server:prod

#######################################################
# Test
#######################################################
FROM node:16 as test

ARG APP_FOLDER
ARG ES_HOST
ENV ES_HOST $ES_HOST

# installs and starts elasticsearch
RUN apt-get update \
	&& apt-get -y upgrade \
	&& wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | apt-key add - \
	&& apt-get install -y apt-transport-https \
	&& echo "deb https://artifacts.elastic.co/packages/7.x/apt stable main" | tee -a /etc/apt/sources.list.d/elastic-7.x.list \
	&& apt-get update \
	&& apt-get install elasticsearch=7.6.0

WORKDIR $APP_FOLDER

COPY --from=builder $APP_FOLDER .

# initializes arranger
CMD service elasticsearch start \
	&& sh docker/test/wait-for-es.sh ${ES_HOST} npm run test \
	&& service elasticsearch stop
