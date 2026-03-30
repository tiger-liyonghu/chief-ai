FROM node:20-slim

WORKDIR /app

# Copy package files and install
COPY package.json package-lock.json* ./
RUN npm install

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Create sessions directory
RUN mkdir -p /data/.wa-sessions

ENV SESSIONS_PATH=/data/.wa-sessions
ENV NODE_ENV=production

EXPOSE 3001
CMD ["node", "dist/index.js"]
