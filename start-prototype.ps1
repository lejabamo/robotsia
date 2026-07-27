# Script para iniciar el prototipo en Docker Desktop (Windows)
Write-Host "=========================================="
Write-Host " Iniciando Prototipo de SIA Observa v2.0  "
Write-Host "=========================================="

# Validar que existe .env
if (-not (Test-Path ".env")) {
    Write-Host "⚠️ Archivo .env no encontrado. Creándolo desde .env.example..."
    Copy-Item .env.example .env
}

# Iniciar Docker Compose
Write-Host "Construyendo y levantando contenedores con Docker Compose (V2)..."
docker compose up --build -d

Write-Host "=========================================="
Write-Host "✅ Prototipo iniciado en segundo plano."
Write-Host "🌐 Puedes acceder al Dashboard en: http://localhost"
Write-Host "🛑 Para detener el prototipo ejecuta: docker-compose down"
Write-Host "=========================================="
