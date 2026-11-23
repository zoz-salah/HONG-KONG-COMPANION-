FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl poppler-utils tesseract-ocr tesseract-ocr-eng tesseract-ocr-chi-tra fonts-noto-cjk && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
RUN mkdir -p /data && chown -R node:node /data /app/.next
USER node
ENV DATABASE_URL=file:/data/companion.db
EXPOSE 3000
CMD ["npm","run","start","--","--hostname","0.0.0.0"]
