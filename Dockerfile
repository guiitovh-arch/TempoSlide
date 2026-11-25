# TempoSlide: frontend + conversor PPTX→PDF (LibreOffice). Vercel Container runtime o cualquier host Docker.
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      libreoffice-impress fonts-liberation fonts-dejavu-core fonts-crosextra-carlito fonts-crosextra-caladea fonts-noto-core \
    && rm -rf /var/lib/apt/lists/*
COPY fonts/ /usr/share/fonts/truetype/temposlide/
RUN fc-cache -f
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev
ENV PORT=80 HOME=/tmp NODE_ENV=production
EXPOSE 80
CMD ["node", "server.js"]
