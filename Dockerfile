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

COPY --from=builder /app /app

EXPOSE 5050

CMD ["npm", "run", "run-prod-server"]

#######################################################
# Arranger Admin UI
#######################################################
FROM node:13.13.0-alpine as ui

ENV APP_UID=9999
ENV APP_GID=9999
ENV APP_HOME=/app
ENV PORT=3000

RUN apk --no-cache add shadow \
	&& groupmod -g $APP_GID node  \
	&& usermod -u $APP_UID -g $APP_GID node \
	&& mkdir -p $APP_HOME \
	&& chown -R node $APP_HOME

COPY --from=builder /app/modules/admin-ui/ $APP_HOME

RUN npm install serve

USER node

WORKDIR $APP_HOME

EXPOSE 8080

CMD ["npm", "run", "run-prod"]
