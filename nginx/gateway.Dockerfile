FROM nginx:1.27-alpine

RUN apk add --no-cache openssl

COPY docker-entrypoint.d/05-gen-localhost-certs.sh /docker-entrypoint.d/05-gen-localhost-certs.sh
RUN chmod +x /docker-entrypoint.d/05-gen-localhost-certs.sh

COPY generated/tenant-servers.conf.template /etc/nginx/templates/default.conf.template
