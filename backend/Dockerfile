FROM node:20-alpine AS builder

RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories && \
    apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com && npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runner

RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories && \
    apk add --no-cache python3 make g++ sqlite

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 runtao

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

RUN npm config set registry https://registry.npmmirror.com && \
    npm install --production && \
    npm rebuild better-sqlite3

RUN mkdir -p /app/data /app/uploads && chown -R runtao:nodejs /app/data /app/uploads

USER runtao

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

CMD ["node", "dist/index.js"]
