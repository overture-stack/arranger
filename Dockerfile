FROM mhart/alpine-node:latest

ENV PROJECT_ID ""

ENV ES_HOST ""

ENV NODE_ENV ""

WORKDIR /app

COPY . /app

RUN apk add --no-cache git bash && \
    npm install && \
    npm run bootstrap -- --scope=@arranger/server --include-filtered-dependencies && \
    npm install -g node-prune && \
    node-prune && \
    npm remove -g node-prune && \
    npm cache clean -f && \
    apk del git bash

CMD cd modules/server && npm run run-prod

FROM nginx:alpine
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
