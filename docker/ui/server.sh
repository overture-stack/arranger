## Shortcircuiting NGINX_CONF_PATH here as a stopgap, while we change the K8s helm charts to take a config map
K8S_PATH=${NGINX_CONF_PATH%/*}
export NGINX_PATH=${K8S_PATH:-$NGINX_PATH}

envsubst < /etc/nginx/env-config.template.js > $NGINX_PATH/env-config.js
envsubst '$PORT,$REACT_APP_ARRANGER_ADMIN_ROOT' < /etc/nginx/nginx.conf.template > $NGINX_PATH/nginx.conf

exec nginx -c $NGINX_PATH/nginx.conf -g 'daemon off;'
