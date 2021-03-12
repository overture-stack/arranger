#######################################################
# Builder
#######################################################
FROM node:13.13.0-alpine as builder

ENV APP_UID=9999
ENV APP_GID=9999
ENV APP_HOME=/app
ENV APP_USER=node

RUN apk --no-cache add shadow
RUN apk --no-cache add shadow \
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

ENV APP_UID=9999
ENV APP_GID=9999
ENV APP_HOME=/app
ENV APP_USER=node

WORKDIR $APP_HOME

USER $APP_USER

EXPOSE 5050

CMD ["npm", "run", "run-prod-server"]

#######################################################
# Builder 2
#######################################################
FROM builder as builder2

ENV APP_UID=9999
ENV APP_GID=9999
ENV APP_HOME=/app
ENV APP_USER=node

WORKDIR $APP_HOME

RUN cd modules/admin-ui \
	&& npm run build
RUN cp -r modules/admin-ui/build ./arranger-admin

#######################################################
# Arranger Admin UI
#######################################################
FROM nginx:1.17.9-alpine as ui

ENV APP_UID=9999
ENV APP_GID=9999
ENV APP_USER=node
ENV APP_HOME=/app
ENV PORT=3000
ENV REACT_APP_BASE_URL=${REACT_APP_BASE_URL:-''}

# expects a writable path for some files to be changed at container boot
# currently, NGINX_CONF_PATH is passed as '/path/filename', whereas it should be '/path', and filenames be specified
ENV NGINX_PATH=${NGINX_PATH:-/etc/nginx}

## Hardwiring /custom-nginx here as a stopgap, while we change the K8s helm charts to take a config map
RUN if [ $(expr $HOSTNAME : k8s) != 0 ]; then \
    	export NGINX_PATH=/custom-nginx; \
		echo 'Kubernetes custom path'; \
	else echo HOSTNAME $HOSTNAME detected; \
    fi
## ^^ end of throwaway code ^^

# This file allows setting defaults for Environment vars to be used in runtime by the client
COPY docker/ui/env-config.js $NGINX_PATH/env-config.js

RUN addgroup -S -g $APP_GID $APP_USER \
	&& adduser -S -u $APP_UID -G $APP_USER $APP_USER \
	&& chown -R $APP_UID:$APP_GID /etc/nginx/ \
	&& chown -R $APP_UID:$APP_GID /var/cache \
	&& chown -R $APP_UID:$APP_GID /var/log/nginx \
	&& chown -R $APP_UID:$APP_GID /run \
	&& mkdir -p $APP_HOME \
	&& chown -R $APP_UID:$APP_GID $APP_HOME \
	&& rm -rf /var/cache/apk/*

COPY --from=builder2 /app $APP_HOME

WORKDIR $APP_HOME

RUN ln -s $NGINX_PATH/env-config.js ./arranger-admin/env-config.js \
	&& chown -R $APP_UID:$APP_GID ./arranger-admin

USER $APP_USER

CMD envsubst < docker/ui/env-config.template.js > $NGINX_PATH/env-config.js \
	&& envsubst '$PORT,$REACT_APP_ARRANGER_ADMIN_ROOT' < docker/ui/nginx.conf.template > $NGINX_PATH/nginx.conf \
	&& exec nginx -c $NGINX_PATH/nginx.conf -g 'daemon off;'

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
	&& apt-get install elasticsearch=7.6.0

# initializes arranger
COPY --from=builder /app ./

CMD service elasticsearch start \
	&& sh docker/test/wait-for-es.sh http://localhost:9200 npm run test \
	&& service elasticsearch stop
