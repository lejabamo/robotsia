/**
 * ============================================
 * Dashboard de Supervisión — Servidor Express
 * ============================================
 * Panel web para que el supervisor:
 * - Vea solicitudes pendientes y su estado
 * - Apruebe/rechace en los 3 puntos de control
 * - Revise evidencia (screenshots)
 * - Consulte estadísticas y auditoría
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const db = require('../utils/database');
const { workflowLogger } = require('../utils/logger');

const log = workflowLogger('DASHBOARD');
const app = express();
const PORT = process.env.DASHBOARD_PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/screenshots', express.static(path.join(__dirname, '../../screenshots')));

// ==========================================
// Página principal — Dashboard HTML
// ==========================================
app.get('/', (req, res) => {
  res.send(generarHTMLDashboard());
});

// ==========================================
// API: Listar solicitudes
// ==========================================
app.get('/api/solicitudes', (req, res) => {
  try {
    const { estado, limite } = req.query;
    const solicitudes = db.listarSolicitudes(estado || null, parseInt(limite) || 50);
    res.json({ exito: true, data: solicitudes });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

// ==========================================
// API: Detalle de una solicitud
// ==========================================
app.get('/api/solicitudes/:id', (req, res) => {
  try {
    const solicitud = db.obtenerSolicitud(parseInt(req.params.id));
    if (!solicitud) return res.status(404).json({ exito: false, error: 'No encontrada' });

    const historial = db.obtenerHistorialAuditoria(solicitud.id);
    res.json({ exito: true, data: { ...solicitud, historial } });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

// ==========================================
// API: Aprobar / Rechazar en punto de control
// ==========================================
app.post('/api/supervision', (req, res) => {
  try {
    const { solicitudId, puntoControl, decision, supervisor, comentario } = req.body;

    if (!solicitudId || !puntoControl || !decision || !supervisor) {
      return res.status(400).json({
        exito: false,
        error: 'Campos requeridos: solicitudId, puntoControl, decision, supervisor'
      });
    }

    db.registrarSupervision(solicitudId, puntoControl, decision, supervisor, comentario || '');

    // Actualizar estado según decisión
    if (decision === 'aprobado') {
      const nuevoEstado = {
        'aprobacion_solicitud': 'aprobado',
        'verificacion_carga': 'carga_verificada',
        'revision_certificado': 'certificado_aprobado'
      }[puntoControl] || 'aprobado';

      db.actualizarEstado(solicitudId, nuevoEstado);
    } else {
      db.actualizarEstado(solicitudId, `rechazado_${puntoControl}`);
    }

    log.info(`Supervisión: ${puntoControl} → ${decision} por ${supervisor}`);

    res.json({
      exito: true,
      mensaje: `Solicitud #${solicitudId} ${decision} en ${puntoControl}`
    });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

// ==========================================
// API: Estadísticas
// ==========================================
app.get('/api/estadisticas', (req, res) => {
  try {
    const stats = db.obtenerEstadisticas();
    res.json({ exito: true, data: stats });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

// ==========================================
// HTML del Dashboard
// ==========================================
function generarHTMLDashboard() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SIA Observa — Panel de Supervisión</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #0a0f1c;
      --bg-secondary: #111827;
      --bg-card: #1e293b;
      --bg-card-hover: #253347;
      --accent: #3b82f6;
      --accent-glow: rgba(59, 130, 246, 0.3);
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --border: rgba(148, 163, 184, 0.1);
      --radius: 12px;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      min-height: 100vh;
    }

    /* Header */
    .header {
      background: linear-gradient(135deg, #1e3a5f 0%, #0d1b2a 100%);
      border-bottom: 1px solid var(--border);
      padding: 1rem 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(20px);
    }

    .header h1 {
      font-size: 1.3rem;
      font-weight: 600;
      background: linear-gradient(135deg, #60a5fa, #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .header .badge-live {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      color: var(--success);
      padding: 4px 12px;
      background: rgba(16, 185, 129, 0.1);
      border-radius: 20px;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .header .badge-live::before {
      content: '';
      width: 8px;
      height: 8px;
      background: var(--success);
      border-radius: 50%;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    /* Main Layout */
    .main {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
    }

    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .stat-card {
      background: var(--bg-card);
      border-radius: var(--radius);
      padding: 1.25rem;
      border: 1px solid var(--border);
      transition: all 0.3s ease;
    }

    .stat-card:hover {
      border-color: var(--accent);
      box-shadow: 0 0 20px var(--accent-glow);
      transform: translateY(-2px);
    }

    .stat-card .label {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 0.5rem;
    }

    .stat-card .value {
      font-size: 2rem;
      font-weight: 700;
      background: linear-gradient(135deg, var(--accent), #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    /* Section */
    .section {
      margin-bottom: 2rem;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .section-title {
      font-size: 1.1rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Filter Tabs */
    .filter-tabs {
      display: flex;
      gap: 0.5rem;
    }

    .filter-tab {
      padding: 6px 16px;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 500;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.2s;
    }

    .filter-tab:hover, .filter-tab.active {
      background: var(--accent);
      color: white;
      border-color: var(--accent);
    }

    /* Table */
    .table-container {
      background: var(--bg-card);
      border-radius: var(--radius);
      border: 1px solid var(--border);
      overflow: hidden;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th {
      text-align: left;
      padding: 0.75rem 1rem;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      background: rgba(0,0,0,0.2);
      border-bottom: 1px solid var(--border);
    }

    td {
      padding: 0.75rem 1rem;
      font-size: 0.85rem;
      border-bottom: 1px solid var(--border);
      color: var(--text-secondary);
    }

    tr:hover td {
      background: var(--bg-card-hover);
    }

    /* Status Badges */
    .status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .status--pendiente {
      background: rgba(245, 158, 11, 0.15);
      color: var(--warning);
      border: 1px solid rgba(245, 158, 11, 0.3);
    }

    .status--proceso {
      background: rgba(59, 130, 246, 0.15);
      color: var(--accent);
      border: 1px solid rgba(59, 130, 246, 0.3);
    }

    .status--completado {
      background: rgba(16, 185, 129, 0.15);
      color: var(--success);
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .status--error {
      background: rgba(239, 68, 68, 0.15);
      color: var(--danger);
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    /* Action Buttons */
    .btn {
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 500;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn--aprobar {
      background: var(--success);
      color: white;
    }

    .btn--aprobar:hover {
      background: #059669;
      box-shadow: 0 0 15px rgba(16, 185, 129, 0.4);
    }

    .btn--rechazar {
      background: var(--danger);
      color: white;
    }

    .btn--rechazar:hover {
      background: #dc2626;
    }

    .btn--ver {
      background: rgba(59, 130, 246, 0.15);
      color: var(--accent);
      border: 1px solid rgba(59, 130, 246, 0.3);
    }

    .actions {
      display: flex;
      gap: 6px;
    }

    /* Modal */
    .modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      backdrop-filter: blur(4px);
      z-index: 200;
      justify-content: center;
      align-items: center;
    }

    .modal-overlay.active {
      display: flex;
    }

    .modal {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 2rem;
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    }

    .modal h2 {
      margin-bottom: 1rem;
      font-size: 1.2rem;
    }

    .modal label {
      display: block;
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-bottom: 4px;
      margin-top: 1rem;
    }

    .modal input, .modal textarea, .modal select {
      width: 100%;
      padding: 8px 12px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 0.85rem;
    }

    .modal textarea { resize: vertical; min-height: 80px; }

    .modal .modal-actions {
      display: flex;
      gap: 0.75rem;
      justify-content: flex-end;
      margin-top: 1.5rem;
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 3rem;
      color: var(--text-muted);
    }

    .empty-state .icon { font-size: 3rem; margin-bottom: 1rem; }

    /* Responsive */
    @media (max-width: 768px) {
      .main { padding: 1rem; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .table-container { overflow-x: auto; }
      table { min-width: 800px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🏛️ SIA Observa — Panel de Supervisión</h1>
    <div class="badge-live">Sistema Activo</div>
  </div>

  <div class="main">
    <!-- Stats -->
    <div class="stats-grid" id="statsGrid">
      <div class="stat-card"><div class="label">Total Solicitudes</div><div class="value" id="statTotal">-</div></div>
      <div class="stat-card"><div class="label">Pendientes Aprobación</div><div class="value" id="statPendientes">-</div></div>
      <div class="stat-card"><div class="label">En Proceso</div><div class="value" id="statProceso">-</div></div>
      <div class="stat-card"><div class="label">Completadas</div><div class="value" id="statCompletadas">-</div></div>
      <div class="stat-card"><div class="label">Errores</div><div class="value" id="statErrores">-</div></div>
    </div>

    <!-- Solicitudes -->
    <div class="section">
      <div class="section-header">
        <div class="section-title">📋 Solicitudes</div>
        <div class="filter-tabs">
          <button class="filter-tab active" onclick="filtrar(null, this)">Todas</button>
          <button class="filter-tab" onclick="filtrar('pendiente_aprobacion', this)">⏳ Pendientes</button>
          <button class="filter-tab" onclick="filtrar('pendiente_revision_certificado', this)">🔍 Revisión</button>
          <button class="filter-tab" onclick="filtrar('error', this)">❌ Errores</button>
        </div>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Contrato</th>
              <th>Contratista</th>
              <th>Pago</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="tablaSolicitudes">
            <tr><td colspan="7" class="empty-state"><div class="icon">📭</div>Cargando solicitudes...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Modal de Supervisión -->
  <div class="modal-overlay" id="modalOverlay">
    <div class="modal">
      <h2 id="modalTitle">Supervisión</h2>
      <div id="modalContent"></div>
      <label>Supervisor</label>
      <input type="text" id="inputSupervisor" placeholder="Nombre del supervisor">
      <label>Comentario</label>
      <textarea id="inputComentario" placeholder="Comentario opcional..."></textarea>
      <div class="modal-actions">
        <button class="btn btn--rechazar" onclick="decidir('rechazado')">❌ Rechazar</button>
        <button class="btn btn--aprobar" onclick="decidir('aprobado')">✅ Aprobar</button>
        <button class="btn btn--ver" onclick="cerrarModal()">Cancelar</button>
      </div>
    </div>
  </div>

  <script>
    let solicitudActual = null;
    let puntoControlActual = null;

    async function cargarSolicitudes(filtroEstado) {
      try {
        const url = filtroEstado
          ? '/api/solicitudes?estado=' + filtroEstado
          : '/api/solicitudes';
        const res = await fetch(url);
        const data = await res.json();

        if (data.exito) renderTabla(data.data);
      } catch (e) {
        console.error('Error cargando solicitudes:', e);
      }
    }

    async function cargarEstadisticas() {
      try {
        const res = await fetch('/api/estadisticas');
        const data = await res.json();
        if (data.exito) {
          document.getElementById('statTotal').textContent = data.data.total || 0;
          const pe = data.data.porEstado || {};
          document.getElementById('statPendientes').textContent = pe.pendiente_aprobacion || 0;
          document.getElementById('statProceso').textContent =
            (pe.descargando_secop || 0) + (pe.cargando_sia || 0) + (pe.generando_certificado || 0);
          document.getElementById('statCompletadas').textContent = pe.finalizado || 0;
          document.getElementById('statErrores').textContent = pe.error || 0;
        }
      } catch (e) { console.error('Error:', e); }
    }

    function renderTabla(solicitudes) {
      const tbody = document.getElementById('tablaSolicitudes');
      if (!solicitudes.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><div class="icon">📭</div>No hay solicitudes</td></tr>';
        return;
      }
      tbody.innerHTML = solicitudes.map(s => {
        const statusClass = getStatusClass(s.estado);
        const fecha = new Date(s.fecha_solicitud).toLocaleDateString('es-CO');
        return '<tr>' +
          '<td>' + s.id + '</td>' +
          '<td><strong>' + s.contrato + '</strong></td>' +
          '<td>' + s.contratista + '</td>' +
          '<td>' + (s.numero_pago || '-') + '</td>' +
          '<td><span class="status ' + statusClass + '">' + formatEstado(s.estado) + '</span></td>' +
          '<td>' + fecha + '</td>' +
          '<td class="actions">' + getAcciones(s) + '</td>' +
          '</tr>';
      }).join('');
    }

    function getStatusClass(estado) {
      if (estado.includes('pendiente') || estado.includes('esperando')) return 'status--pendiente';
      if (estado.includes('error') || estado.includes('rechazado')) return 'status--error';
      if (estado === 'finalizado') return 'status--completado';
      return 'status--proceso';
    }

    function formatEstado(estado) {
      const map = {
        'pendiente_aprobacion': '⏳ Pend. Aprobación',
        'aprobado': '✅ Aprobado',
        'descargando_secop': '⬇️ Descargando',
        'validando_pdfs': '📄 Validando PDFs',
        'cargando_sia': '⬆️ Cargando SIA',
        'pendiente_verificacion_carga': '🔍 Verificar Carga',
        'extrayendo_datos': '🤖 Extrayendo',
        'generando_certificado': '📝 Generando',
        'pendiente_revision_certificado': '🔍 Revisar Cert.',
        'certificado_aprobado': '✅ Cert. Aprobado',
        'enviado_firma': '✉️ Enviado Firma',
        'finalizado': '✅ Finalizado',
        'error': '❌ Error'
      };
      return map[estado] || estado;
    }

    function getAcciones(s) {
      let html = '<button class="btn btn--ver" onclick="verDetalle(' + s.id + ')">👁️</button>';
      if (s.estado === 'pendiente_aprobacion') {
        html += '<button class="btn btn--aprobar" onclick="abrirSupervision(' + s.id + ', \\'aprobacion_solicitud\\')">✅</button>';
      }
      if (s.estado === 'pendiente_verificacion_carga') {
        html += '<button class="btn btn--aprobar" onclick="abrirSupervision(' + s.id + ', \\'verificacion_carga\\')">✅</button>';
      }
      if (s.estado === 'pendiente_revision_certificado') {
        html += '<button class="btn btn--aprobar" onclick="abrirSupervision(' + s.id + ', \\'revision_certificado\\')">✅</button>';
      }
      return html;
    }

    function abrirSupervision(id, punto) {
      solicitudActual = id;
      puntoControlActual = punto;
      const titulos = {
        'aprobacion_solicitud': '🔍 Aprobar Solicitud #' + id,
        'verificacion_carga': '🔍 Verificar Carga SIA #' + id,
        'revision_certificado': '🔍 Revisar Certificado #' + id
      };
      document.getElementById('modalTitle').textContent = titulos[punto] || 'Supervisión';
      document.getElementById('modalOverlay').classList.add('active');
    }

    async function decidir(decision) {
      const supervisor = document.getElementById('inputSupervisor').value;
      const comentario = document.getElementById('inputComentario').value;

      if (!supervisor) { alert('Ingrese nombre del supervisor'); return; }

      try {
        const res = await fetch('/api/supervision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            solicitudId: solicitudActual,
            puntoControl: puntoControlActual,
            decision,
            supervisor,
            comentario
          })
        });
        const data = await res.json();
        if (data.exito) {
          alert(data.mensaje);
          cerrarModal();
          cargarSolicitudes();
          cargarEstadisticas();
        }
      } catch (e) { alert('Error: ' + e.message); }
    }

    async function verDetalle(id) {
      try {
        const res = await fetch('/api/solicitudes/' + id);
        const data = await res.json();
        if (data.exito) {
          const s = data.data;
          document.getElementById('modalTitle').textContent = 'Detalle Solicitud #' + id;
          document.getElementById('modalContent').innerHTML =
            '<p><strong>Contrato:</strong> ' + s.contrato + '</p>' +
            '<p><strong>Contratista:</strong> ' + s.contratista + '</p>' +
            '<p><strong>Correo:</strong> ' + (s.correo_solicitante || '-') + '</p>' +
            '<p><strong>Pago:</strong> ' + (s.numero_pago || '-') + '</p>' +
            '<p><strong>Estado:</strong> ' + formatEstado(s.estado) + '</p>' +
            '<p><strong>Errores:</strong> ' + (s.errores || 'Ninguno') + '</p>' +
            '<hr style="border-color:var(--border);margin:1rem 0">' +
            '<h3 style="font-size:0.9rem;margin-bottom:0.5rem">Historial</h3>' +
            (s.historial || []).map(h =>
              '<p style="font-size:0.75rem;color:var(--text-muted)">[' + h.timestamp + '] ' + h.workflow + ': ' + h.evento + '</p>'
            ).join('');
          document.getElementById('modalOverlay').classList.add('active');
        }
      } catch (e) { alert('Error: ' + e.message); }
    }

    function cerrarModal() {
      document.getElementById('modalOverlay').classList.remove('active');
      document.getElementById('inputSupervisor').value = '';
      document.getElementById('inputComentario').value = '';
      document.getElementById('modalContent').innerHTML = '';
    }

    function filtrar(estado, btn) {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      cargarSolicitudes(estado);
    }

    // Cargar al inicio
    cargarSolicitudes();
    cargarEstadisticas();

    // Auto-refresh cada 30 segundos
    setInterval(() => {
      cargarSolicitudes();
      cargarEstadisticas();
    }, 30000);
  </script>
</body>
</html>`;
}

// ==========================================
// Iniciar servidor
// ==========================================
function iniciarDashboard() {
  db.initDatabase();

  app.listen(PORT, () => {
    log.info(`🖥️  Dashboard de supervisión activo en http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  iniciarDashboard();
}

module.exports = { app, iniciarDashboard };
