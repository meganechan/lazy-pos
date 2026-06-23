# ---- stage 1: build React client ----
FROM node:20-alpine AS client
WORKDIR /app/client
COPY client/package.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# ---- stage 2: server + built client ----
FROM node:20-alpine
WORKDIR /app
COPY server/package.json ./server/
RUN cd server && npm install --omit=dev
COPY server/ ./server/
COPY db/ ./db/
COPY --from=client /app/client/dist ./client/dist
EXPOSE 8080
CMD ["node", "server/index.js"]
