FROM node:20-alpine AS builder

WORKDIR /app

ARG REACT_APP_API_URL=http://localhost:8000/
ENV REACT_APP_API_URL=$REACT_APP_API_URL

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
