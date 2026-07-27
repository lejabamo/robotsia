FROM node:20-slim

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar dependencias e instalar
COPY package.json ./
RUN npm install --production

# Copiar código fuente
COPY src/ ./src/
COPY templates/ ./templates/

# Crear directorios de almacenamiento
RUN mkdir -p storage/logs storage/certificados downloads screenshots

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:4000/api/health || exit 1

CMD ["node", "src/server.js"]
