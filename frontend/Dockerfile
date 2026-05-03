# Build context must be the repository root (Easypanel / monorepo default).
# Example: docker build -f frontend/Dockerfile .
FROM node:20-alpine AS build

WORKDIR /app

COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile

COPY frontend/ .

# Baked into the JS bundle at build time (docker build --build-arg).
# On Easypanel, set BACKEND_URL (or REACT_APP_BACKEND_URL) on the running frontend service for runtime override.
ARG REACT_APP_BACKEND_URL=http://localhost:8001
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
ENV DISABLE_ESLINT_PLUGIN=true

RUN yarn build

FROM nginx:alpine

RUN apk add --no-cache gettext

COPY frontend/nginx.docker.conf /etc/nginx/nginx.conf
COPY frontend/docker-entrypoint.sh /docker-entrypoint.sh
COPY frontend/runtime-config.js.template /runtime-config.js.template
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
