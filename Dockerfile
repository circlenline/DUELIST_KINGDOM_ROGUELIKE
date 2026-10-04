FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*

COPY index.html /usr/share/nginx/html/index.html
COPY goat-simulador.html /usr/share/nginx/html/goat-simulador.html
COPY deckbuilder.html /usr/share/nginx/html/deckbuilder.html
COPY docs /usr/share/nginx/html/docs
COPY robots.txt /usr/share/nginx/html/robots.txt
COPY sitemap.xml /usr/share/nginx/html/sitemap.xml

EXPOSE 80
