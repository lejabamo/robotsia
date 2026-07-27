#!/bin/bash
# ============================================
# Backup Diario — Base de datos y certificados
# ============================================
# Agregar al crontab:
#   sudo crontab -e
#   0 2 * * * /opt/sia-observa/deploy/backup.sh >> /var/log/sia-backup.log 2>&1
#
# Retención: 30 días

set -euo pipefail

APP_DIR="/opt/sia-observa"
BACKUP_DIR="/opt/sia-backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

echo "=== Backup SIA Observa — $DATE ==="

mkdir -p "$BACKUP_DIR"

# 1. Copiar base de datos SQLite
STORAGE_VOLUME=$(docker volume inspect sia-observa_app_storage -f '{{.Mountpoint}}' 2>/dev/null || echo "")

if [ -n "$STORAGE_VOLUME" ] && [ -f "$STORAGE_VOLUME/auditoria.db" ]; then
    cp "$STORAGE_VOLUME/auditoria.db" "$BACKUP_DIR/auditoria_$DATE.db"
    echo "✅ BD copiada"
else
    # Backup via docker cp
    docker cp sia-app:/storage/auditoria.db "$BACKUP_DIR/auditoria_$DATE.db" 2>/dev/null || echo "⚠️ BD no accesible"
fi

# 2. Copiar certificados generados
if [ -n "$STORAGE_VOLUME" ] && [ -d "$STORAGE_VOLUME/certificados" ]; then
    tar -czf "$BACKUP_DIR/certificados_$DATE.tar.gz" -C "$STORAGE_VOLUME" certificados/ 2>/dev/null || echo "⚠️ Sin certificados nuevos"
    echo "✅ Certificados respaldados"
fi

# 3. Exportar Redis (dump)
docker exec sia-redis redis-cli -a "${REDIS_PASSWORD:-SiaRedis2026!}" BGSAVE 2>/dev/null
sleep 2
docker cp sia-redis:/data/dump.rdb "$BACKUP_DIR/redis_$DATE.rdb" 2>/dev/null || echo "⚠️ Redis dump no disponible"
echo "✅ Redis respaldado"

# 4. Comprimir todo en un solo archivo
tar -czf "$BACKUP_DIR/sia_backup_$DATE.tar.gz" \
    "$BACKUP_DIR/auditoria_$DATE.db" \
    "$BACKUP_DIR/redis_$DATE.rdb" \
    "$BACKUP_DIR/certificados_$DATE.tar.gz" 2>/dev/null

# Limpiar archivos individuales
rm -f "$BACKUP_DIR/auditoria_$DATE.db" "$BACKUP_DIR/redis_$DATE.rdb" "$BACKUP_DIR/certificados_$DATE.tar.gz"

# 5. Eliminar backups antiguos
find "$BACKUP_DIR" -name "sia_backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete
echo "✅ Backups > ${RETENTION_DAYS} días eliminados"

# 6. Mostrar espacio usado
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
echo "✅ Backup completado: $BACKUP_DIR/sia_backup_$DATE.tar.gz ($BACKUP_SIZE total)"
