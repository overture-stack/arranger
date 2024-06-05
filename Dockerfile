FROM node:14.21-alpine as builder

RUN addgroup --system arranger && \
    adduser -S arranger -G arranger

WORKDIR /app
COPY . .
RUN chown -R arranger:arranger /app

FROM builder as arranger-server

WORKDIR modules/server-filter
RUN chown -R arranger:arranger /app/modules/server-filter
USER arranger
RUN npm install
ENTRYPOINT ["node","server.js"]


FROM builder as arranger-admin-server

WORKDIR modules/admin
RUN chown -R arranger:arranger /app/modules/admin
USER arranger
RUN npm install
ENTRYPOINT ["node","admin-server.js"]

FROM builder as arranger-admin-ui
USER arranger
RUN npm ci
RUN npm run bootstrap
WORKDIR modules/admin-ui
USER root
RUN chown -R arranger:arranger /app/modules/admin-ui
USER arranger
ENTRYPOINT ["npm", "run", "start"]
