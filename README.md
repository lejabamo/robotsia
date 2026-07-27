# 🏛️ Automatización SIA Observa — Certificados OPS

Sistema automatizado para la generación de certificados SIA Observa de contratos OPS de la Gobernación del Cauca.

## 📋 Descripción

Este sistema reemplaza el proceso manual de generación de certificados SIA Observa, automatizando:

- ✅ Recepción y análisis de solicitudes por correo
- ✅ Descarga de documentos desde SECOP II
- ✅ Validación y compresión de PDFs
- ✅ Carga de documentos en SIA Observa
- ✅ Extracción de datos contractuales con IA
- ✅ Generación de certificados Word
- ✅ Envío para firma y entrega al contratista

**Con 3 puntos de supervisión humana** para garantizar la calidad y seguridad.

## 🏗️ Arquitectura

```
┌──────────────────────────────────────────────┐
│                n8n (Orquestador)              │
│  WF-01 → WF-02 → WF-03 → ... → WF-09       │
├──────────────────────────────────────────────┤
│         Microservicio Playwright              │
│    (SECOP II + SIA Observa Browser)          │
├──────────────────────────────────────────────┤
│         Dashboard de Supervisión              │
│         (Express + SQLite)                    │
├──────────────────────────────────────────────┤
│            IA (OpenAI GPT-4o)                │
│    (Extracción datos correo + contrato)      │
└──────────────────────────────────────────────┘
```

## 📁 Estructura del Proyecto

```
Automatizacion SIA/
├── src/
│   ├── index.js                # Orquestador principal
│   ├── ai/
│   │   └── extractor.js        # Extracción de datos con IA
│   ├── playwright/
│   │   ├── secop-download.js   # Automatización SECOP II
│   │   └── sia-upload.js       # Automatización SIA Observa
│   ├── certificate/
│   │   └── generate.js         # Generación de certificados DOCX
│   ├── dashboard/
│   │   └── server.js           # Dashboard de supervisión web
│   └── utils/
│       ├── database.js         # Base de datos SQLite (auditoría)
│       ├── logger.js           # Logger centralizado
│       ├── helpers.js          # Utilidades comunes
│       └── pdf-validator.js    # Validación y compresión PDF
├── n8n-workflows/
│   ├── WF-01-recepcion-solicitud.json
│   └── WF-09-auditoria.json
├── templates/                  # Plantillas Word
│   ├── plantilla_persona_natural.docx
│   └── plantilla_persona_juridica.docx
├── storage/                    # Datos y certificados (gitignored)
├── docker-compose.yml          # Infraestructura Docker
├── Dockerfile.dashboard
├── package.json
├── .env.example
└── README.md
```

## 🚀 Instalación

### Requisitos
- Node.js >= 18
- Docker y Docker Compose (para n8n)
- Ghostscript (para compresión PDF)
- Cuenta OpenAI API

### Pasos

1. **Clonar y configurar:**
```bash
cd "Automatizacion SIA"
cp .env.example .env
# Editar .env con las credenciales reales
```

2. **Instalar dependencias:**
```bash
npm install
npx playwright install chromium
```

3. **Crear directorios de almacenamiento:**
```bash
mkdir -p storage/logs storage/certificados downloads screenshots
```

4. **Colocar las plantillas Word** en `templates/`:
   - `plantilla_persona_natural.docx` (con variables `{{codigo}}`, `{{nombre}}`, etc.)
   - `plantilla_persona_juridica.docx`

5. **Iniciar servicios Docker:**
```bash
docker-compose up -d
```

6. **Importar workflows en n8n:**
   - Acceder a http://localhost:5678
   - Importar los archivos de `n8n-workflows/`

7. **Iniciar el dashboard:**
```bash
npm run dashboard
# Dashboard disponible en http://localhost:3000
```

## 🔐 Seguridad

| Control | Implementación |
|---------|---------------|
| Credenciales | Cifradas en `.env` y n8n Credentials Manager |
| Acceso n8n | Autenticación básica + VPN recomendada |
| Logs | Registro inmutable de cada operación |
| Screenshots | Evidencia visual de cargas en SIA Observa |
| Reintentos | Máximo 3 con backoff exponencial |
| Segregación | Agente ejecuta ≠ Supervisor aprueba |

## 🔍 Puntos de Supervisión

El sistema tiene **3 puntos de control obligatorio**:

| # | Punto | Qué revisa el supervisor |
|---|-------|--------------------------|
| 1 | Aprobación solicitud | ¿Datos correctos? ¿Solicitud legítima? |
| 2 | Verificación carga SIA | ¿Documentos cargados correctamente? |
| 3 | Revisión certificado | ¿Datos del certificado correctos? |

## 📊 Dashboard

Acceder a `http://localhost:3000` para:
- Ver todas las solicitudes y su estado
- Aprobar/rechazar en los puntos de control
- Ver historial de auditoría
- Consultar estadísticas en tiempo real

## 🔧 Scripts Disponibles

```bash
npm start                    # Ejecutar orquestador
npm run dashboard            # Iniciar dashboard supervisión
npm run secop:download       # Descarga desde SECOP II
npm run sia:upload           # Carga en SIA Observa
npm run pdf:validate         # Validar/comprimir PDFs
npm run certificate:generate # Generar certificado
```

## 📞 Soporte

Para problemas técnicos, revisar:
1. Logs en `storage/logs/`
2. Dashboard en `http://localhost:3000`
3. Historial de auditoría en la base de datos SQLite
