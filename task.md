# Tareas — Automatización SIA Observa (Arquitectura Profesional)

## Fase 0 — Reestructuración e Infraestructura
- [x] Actualizar package.json con nuevas dependencias (BullMQ, ioredis, socket.io, jwt)
- [x] Actualizar docker-compose.yml (Redis solamente)
- [x] Actualizar .env.example con nuevas variables
- [x] Eliminar archivos n8n obsoletos

## Fase 1 — Backend Core
- [x] Crear config/env.js (configuración centralizada)
- [x] Crear config/redis.js (conexión Redis)
- [x] Crear config/database.js (BD con tablas de auth + auditoría)
- [x] Crear queues/queue-manager.js (gestión central BullMQ)
- [x] Crear queues/state-machine.js (máquina de estados workflow)
- [x] Crear server.js (Express + Socket.io)

## Fase 2 — API REST + Autenticación
- [x] Crear api/middleware/auth.js (JWT)
- [x] Crear api/middleware/roles.js (control de roles)
- [x] Crear api/routes/auth.js (login/registro)
- [x] Crear api/routes/solicitudes.js (CRUD)
- [x] Crear api/routes/supervision.js (aprobaciones)
- [x] Crear api/routes/auditoria.js (historial)
- [x] Crear api/routes/colas.js (estado de workers)

## Fase 3 — Workers BullMQ
- [x] Crear workers/email-worker.js
- [x] Crear workers/secop-worker.js
- [x] Crear workers/pdf-worker.js
- [x] Crear workers/sia-worker.js
- [x] Crear workers/extraction-worker.js
- [x] Crear workers/certificate-worker.js
- [x] Crear workers/notification-worker.js

## Fase 4 — Dashboard Profesional
- [x] Crear dashboard HTML/CSS/JS premium con dark theme
- [x] Implementar WebSocket para tiempo real
- [x] Panel principal con estadísticas
- [x] Vista detalle de solicitud con timeline
- [x] Flujo de aprobación en 3 puntos de control
- [x] Vista de colas de trabajo
- [x] Panel de auditoría

## Fase 5 — Documentación y Visores
- [x] Actualizar README.md
- [x] Crear guía de supervisor
- [x] Instalar visor PDF ligero (SumatraPDF) en el equipo del usuario
- [x] Crear walkthrough final
