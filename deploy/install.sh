#!/bin/bash
# ============================================
# Script de Instalación Completa en VM Ubuntu
# ============================================
# Ejecutar como root o con sudo:
#   chmod +x deploy/install.sh
#   sudo ./deploy/install.sh
#
# Requisitos: Ubuntu 22.04 LTS con acceso a internet

set -euo pipefail

echo "================================================"
echo "  Instalación Agente SIA Observa v2.0"
echo "  Gobernación del Cauca"
echo "================================================"
echo ""

APP_DIR="/opt/sia-observa"

# 1. Actualizar sistema
echo "📦 Actualizando sistema..."
apt-get update -y && apt-get upgrade -y

# 2. Instalar Docker
echo "🐳 Instalando Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "✅ Docker instalado"
else
    echo "✅ Docker ya instalado"
fi

# 3. Instalar Docker Compose (plugin)
echo "🐳 Verificando Docker Compose..."
if ! docker compose version &> /dev/null; then
    apt-get install -y docker-compose-plugin
fi
echo "✅ Docker Compose: $(docker compose version)"

# 4. Crear directorio de la aplicación
echo "📁 Creando estructura..."
mkdir -p $APP_DIR
mkdir -p /opt/sia-backups

# 5. Copiar proyecto (ajustar la fuente según el caso)
if [ -d "./src" ]; then
    cp -r ./* $APP_DIR/
    echo "✅ Proyecto copiado a $APP_DIR"
else
    echo "⚠️ Ejecute este script desde el directorio del proyecto"
    echo "   O clone el repositorio en $APP_DIR"
fi

cd $APP_DIR

# 6. Configurar .env
if [ ! -f .env ]; then
    cp .env.example .env
    echo "⚠️ Archivo .env creado. EDITE las credenciales antes de continuar:"
    echo "   nano $APP_DIR/.env"
    echo ""
    echo "   Luego ejecute: docker compose up -d"
    echo ""
fi

# 7. Instalar servicio systemd
echo "🔧 Instalando servicio systemd..."
cp deploy/sia-observa.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable sia-observa
echo "✅ Servicio sia-observa habilitado (arrancará con el sistema)"

# 8. Configurar backup diario
echo "💾 Configurando backup diario..."
chmod +x deploy/backup.sh
(crontab -l 2>/dev/null; echo "0 2 * * * $APP_DIR/deploy/backup.sh >> /var/log/sia-backup.log 2>&1") | sort -u | crontab -
echo "✅ Backup programado a las 2:00 AM"

# 9. Configurar firewall
echo "🔒 Configurando firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp    # SSH
    ufw allow 80/tcp    # HTTP (redirect)
    ufw allow 443/tcp   # HTTPS
    ufw --force enable
    echo "✅ Firewall configurado (puertos 22, 80, 443)"
fi

# 10. Resumen
echo ""
echo "================================================"
echo "  ✅ Instalación completada"
echo "================================================"
echo ""
echo "  Próximos pasos:"
echo "  1. Editar credenciales:  nano $APP_DIR/.env"
echo "  2. Colocar Service Account: $APP_DIR/credentials/service-account.json"
echo "  3. Colocar plantillas Word: $APP_DIR/templates/"
echo "  4. Iniciar servicios:    cd $APP_DIR && docker compose up -d"
echo "  5. Ver dashboard:        https://IP-DEL-SERVIDOR"
echo "  6. Login por defecto:    admin@sia.local / admin123"
echo ""
echo "  Comandos útiles:"
echo "  - Ver logs:              docker compose logs -f"
echo "  - Ver estado:            docker compose ps"
echo "  - Reiniciar:             docker compose restart"
echo "  - Parar:                 docker compose down"
echo ""
