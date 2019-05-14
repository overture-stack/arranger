FROM nginx

RUN apt-get update -y && apt-get upgrade -y
RUN apt-get install curl -y
RUN apt-get install sudo -y
RUN curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash - && apt-get install nodejs -y

# bootstraps arranger dependencies 
WORKDIR /app
COPY . /app
RUN npm i
RUN npm run bootstrap

# builds admin ui and storybook
RUN cd modules/admin-ui && REACT_APP_ARRANGER_ADMIN_ROOT=/admin/graphql npm run build
RUN cd modules/components && STORYBOOK_ES_HOST=http://elasticsearch:9200 STORYBOOK_ARRANGER_API=/ npm run build-storybook

# copies build-bundles out
RUN cp -r modules/admin-ui/build ./arranger-admin
RUN cp -r modules/components/storybook-static ./arranger-storybook

COPY nginx.conf /etc/nginx/nginx.conf

CMD nginx -g "daemon off;"
