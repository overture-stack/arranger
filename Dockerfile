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
RUN apk --no-cache add shadow
RUN groupmod -g $APP_GID node 
RUN usermod -u $APP_UID -g $APP_GID node
RUN mkdir -p /app
RUN chown -R node /app
USER node
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 5050
WORKDIR modules/server

CMD ["npm", "run", "run-prod"]

# Example in: workflow-traffic

#######################################################
# Arranger Admin UI
#######################################################
