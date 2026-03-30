FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production image
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy standalone build + static assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# WhatsApp sessions persist in /data
RUN mkdir -p /data/.wa-sessions
ENV WA_SESSIONS_PATH=/data/.wa-sessions

EXPOSE 3000

CMD ["node", "server.js"]
