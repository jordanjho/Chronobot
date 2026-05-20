# Stage 1: Build — compile TypeScript to dist/
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
COPY prisma/ ./prisma/

RUN npx prisma generate
RUN npm run build

# Stage 2: Runtime — minimal image with only compiled output
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled JS and Prisma generated client
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma/ ./prisma/

# Expose metrics server port (added in PR3B; harmless if PR3B not merged yet)
EXPOSE 9090

# Run migrations then start the bot
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
