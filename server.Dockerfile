FROM mhart/alpine-node:13.13.0

RUN apk add --no-cache curl

ENV PROJECT_ID ""

ENV ES_HOST ""

ENV NODE_ENV ""

WORKDIR /app

COPY . /app

RUN npm ci
RUN npm config set unsafe-perm true && npm run bootstrap

EXPOSE 5050

CMD cd modules/server && npm run run-prod
