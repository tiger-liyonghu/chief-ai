FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build-time env vars needed for Next.js to compile API routes
# These are placeholder values - real values are set at runtime via Railway
ARG DEEPSEEK_API_KEY=sk-placeholder
ARG NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder
ENV DEEPSEEK_API_KEY=$DEEPSEEK_API_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

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
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

CMD ["node", "server.js"]
