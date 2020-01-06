FROM node:12.13.1

WORKDIR /app

# installs and starts elasticsearch
RUN apt-get update
RUN apt-get -y upgrade
RUN wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | apt-key add -
RUN apt-get install apt-transport-https
RUN echo "deb https://artifacts.elastic.co/packages/7.x/apt stable main" | tee -a /etc/apt/sources.list.d/elastic-7.x.list
RUN apt-get update
RUN apt-get install elasticsearch=7.5.0

# initializes arranger
COPY ./ ./
COPY ./integration-tests ./integration-tests
RUN npm ci
RUN npm run bootstrap

CMD service elasticsearch start && sh wait-for-es.sh http://localhost:9200 npm run test && service elasticsearch stop