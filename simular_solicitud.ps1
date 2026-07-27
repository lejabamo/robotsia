# Script para simular la llegada de un correo y crear una solicitud de prueba en el Dashboard
Write-Host "=========================================="
Write-Host " Simulador de Solicitudes SIA Observa "
Write-Host "=========================================="

$baseUrl = "http://localhost/api"

# 1. Hacer Login como Admin para obtener el Token
Write-Host "Iniciando sesión como admin@sia.local..."
$loginBody = @{
    email = "admin@sia.local"
    password = "admin123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.token
    Write-Host "✅ Login exitoso. Token obtenido."
} catch {
    Write-Host "❌ Error al iniciar sesión. Verifica que Docker esté corriendo."
    exit
}

# 2. Crear una solicitud simulada
Write-Host "Creando solicitud de certificado de prueba..."
$solicitudBody = @{
    contrato = "CT-$(Get-Random -Minimum 1000 -Maximum 9999)-2026"
    contratista = "Ingeniería y Construcciones de Prueba S.A.S."
    correo = "prueba@dominio.com"
    numeroPago = $(Get-Random -Minimum 1 -Maximum 12)
    numeroActa = $(Get-Random -Minimum 1 -Maximum 5)
} | ConvertTo-Json

$headers = @{
    Authorization = "Bearer $token"
}

try {
    $solicitudResponse = Invoke-RestMethod -Uri "$baseUrl/solicitudes" -Method Post -Headers $headers -Body $solicitudBody -ContentType "application/json"
    Write-Host "✅ ¡Solicitud inyectada exitosamente!"
    Write-Host "Vuelve al Dashboard en tu navegador web. Deberías ver la solicitud aparecer en TIEMPO REAL."
} catch {
    Write-Host "❌ Error al crear la solicitud."
}
Write-Host "=========================================="
