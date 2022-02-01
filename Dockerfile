#######################################################
# Builder
#######################################################
FROM node:13.13.0-alpine as builder

ENV APP_UID=1000
ENV APP_GID=1000
ENV APP_HOME=/app
ENV APP_USER=node

RUN apk --no-cache add curl g++ make python3 shadow \
	&& groupmod -g $APP_GID $APP_USER \
	&& usermod -u $APP_UID -g $APP_GID $APP_USER \
	&& mkdir -p $APP_HOME \
	&& chown -R $APP_USER $APP_HOME

WORKDIR $APP_HOME

COPY . .

RUN npm ci \
	&& npm config set unsafe-perm true \
	&& npm run bootstrap

#######################################################
# Arranger Server
#######################################################
FROM builder as server

ENV APP_UID=1000
ENV APP_GID=1000
ENV APP_HOME=/app
ENV APP_USER=node
ENV ES_HOST=http://localhost:9200

WORKDIR $APP_HOME

USER $APP_USER

EXPOSE 5050

CMD make _ping_elasticsearch_server -e && BABEL_DISABLE_CACHE=1 npm run server:prod

#######################################################
# Test
#######################################################
FROM node:13.13.0 as test

WORKDIR /app

# installs and starts elasticsearch
RUN apt-get update \
	&& apt-get -y upgrade \
	&& wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | apt-key add - \
	&& apt-get install -y apt-transport-https \
	&& echo "deb https://artifacts.elastic.co/packages/7.x/apt stable main" | tee -a /etc/apt/sources.list.d/elastic-7.x.list \
	&& apt-get update \
	&& apt-get install elasticsearch=7.16.3

# initializes arranger
COPY --from=builder /app ./

CMD service elasticsearch start \
	&& sh docker/test/wait-for-es.sh http://localhost:9200 npm run test \
	&& service elasticsearch stop
