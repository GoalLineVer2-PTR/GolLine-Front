FROM nginx:1.27-alpine

# Copiar el Cartel Gigante del Estadio
COPY css/ /usr/share/nginx/html/css/
COPY html/ /usr/share/nginx/html/html/
COPY js/ /usr/share/nginx/html/js/

# Redirigir / hacia /html/index.html para abrir directamente en http://localhost:8081
RUN printf 'server {\n    listen 80;\n    root /usr/share/nginx/html;\n    location = / { return 302 /html/index.html; }\n    location / { try_files $uri $uri/ =404; }\n}\n' > /etc/nginx/conf.d/default.conf

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV API_URL=http://localhost:8080
EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
