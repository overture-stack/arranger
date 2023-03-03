FROM node:14.21-alpine as builder

WORKDIR /app
COPY . .

FROM builder as arranger-server

WORKDIR modules/server-filter
RUN npm install
ENTRYPOINT ["node","server.js"]


FROM builder as arranger-admin-server

WORKDIR modules/admin
RUN npm install
ENTRYPOINT ["node","admin-server.js"]

FROM builder as arranger-admin-ui
RUN npm ci
RUN npm run bootstrap
WORKDIR modules/admin-ui
ENTRYPOINT ["npm", "run", "start"]
