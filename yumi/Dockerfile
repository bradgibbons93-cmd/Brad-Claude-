FROM oven/bun:1.4.3-slim
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY public ./public
COPY assets ./assets
ENV NODE_ENV=production
EXPOSE 8080
CMD ["bun", "src/server.ts"]
