FROM nginx:1.17.9

RUN apt-get update -y && apt-get upgrade -y
RUN apt-get install curl -y
RUN apt-get install sudo -y
RUN curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash - && apt-get install nodejs -y

# bootstraps arranger dependencies 
WORKDIR /app
COPY . /app
RUN npm ci
RUN npm config set unsafe-perm true && npm run bootstrap

# builds admin ui and storybook
RUN cd modules/admin-ui && REACT_APP_ARRANGER_ADMIN_ROOT=/admin/graphql npm run build
RUN cd modules/components && STORYBOOK_ES_HOST=http://elasticsearch:9200 STORYBOOK_ARRANGER_API=/ npm run build-storybook

# copies build-bundles out
RUN cp -r modules/admin-ui/build ./arranger-admin
RUN cp -r modules/components/storybook-static ./arranger-storybook

COPY nginx.conf /etc/nginx/nginx.conf

CMD nginx -g "daemon off;"

######
# From workflow-gateway
######

#    FROM nginx:1.17.9-alpine
#    
#    ENV APP_UID=9999
#    ENV APP_GID=9999
#    ENV APP_USER=node
#    
#    COPY nginx.conf.template /etc/nginx/nginx.conf.template
#    
#    RUN addgroup -S -g $APP_GID $APP_USER \
#    	&& adduser -S -u $APP_UID -G $APP_USER $APP_USER \
#    	&& chown -R $APP_UID:$APP_GID /etc/nginx/ \
#    	&& chown -R $APP_UID:$APP_GID /var/cache \
#    	&& chown -R $APP_UID:$APP_GID /var/log/nginx \
#    	&& chown -R $APP_UID:$APP_GID /run \
#    	&& rm -rf /var/cache/apk/*
#    
#    USER $APP_UID
#    
#    CMD envsubst '$PORT,$WF_MANAGEMENT_HOST,$WF_SEARCH_HOST,$WF_UI_HOST,$WF_DOCS_HOST' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf && exec nginx -g 'daemon off;'
