#######################################################
# Builder
#######################################################
FROM node:13.13.0-alpine as builder

RUN apk --no-cache add shadow
RUN mkdir -p /app
WORKDIR /app
COPY . .

RUN npm ci \
	&& npm config set unsafe-perm true \
	&& npm run bootstrap

#######################################################
# Arranger Server
#######################################################
FROM node:13.13.0-alpine as server

ENV APP_UID=9999
ENV APP_GID=9999
ENV APP_HOME=/app

RUN apk --no-cache add shadow \
	&& groupmod -g $APP_GID node \
	&& usermod -u $APP_UID -g $APP_GID node \
	&& mkdir -p $APP_HOME \
	&& chown -R node $APP_HOME

USER node

COPY --from=builder /app $APP_HOME

WORKDIR $APP_HOME

EXPOSE 5050

CMD ["npm", "run", "run-prod-server"]

#######################################################
# Builder 2
#######################################################
FROM node:13.13.0-alpine as builder2

RUN apk --no-cache add shadow
COPY --from=builder /app /app
WORKDIR /app

RUN cd modules/admin-ui \
	&& REACT_APP_ARRANGER_ADMIN_ROOT=/admin/graphql npm run build
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

COPY docker/ui/nginx.conf.template /etc/nginx/nginx.conf.template

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

USER $APP_UID

CMD envsubst '$PORT,$REACT_APP_ARRANGER_ADMIN_ROOT' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf && exec nginx -g 'daemon off;'
