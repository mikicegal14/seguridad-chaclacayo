# Imagen base oficial de Node.js LTS
FROM node:20-alpine

# Directorio de trabajo
WORKDIR /app

# Instalar dependencias necesarias para compilar módulos si aplica
RUN apk add --no-cache python3 make g++

# Copiar definiciones de dependencias
COPY package*.json ./

# Instalar dependencias de producción
RUN npm ci --only=production

# Copiar el código fuente
COPY . .

# Crear carpeta de uploads
RUN mkdir -p uploads

# Exponer el puerto del backend
EXPOSE 3000

# Usuario no root para seguridad
USER node

# Comando de inicio
CMD ["node", "src/index.js"]
