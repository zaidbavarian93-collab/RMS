# صورة واحدة للنظام كاملًا: تبني الواجهة ثم يقدّمها الخادم بنفسه (موقع أو خادم محلي)
FROM node:20-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=4000 FRONTEND_DIST=/app/public
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ ./
COPY --from=web /web/dist ./public
EXPOSE 4000
CMD ["node", "src/index.js"]
