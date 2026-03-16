FROM node:18-alpine

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Install dependencies first (layer cache)
COPY package.json ./
RUN npm install --omit=dev

# Copy source
COPY . .

# Switch to non-root user
USER appuser

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
