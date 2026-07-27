/**
 * ============================================
 * Frontend Logic — SPA Dashboard SIA Observa
 * ============================================
 */

let token = localStorage.getItem('sia_token');
let socket = null;
let currentView = 'dashboard';
let cacheSolicitudes = [];
let filtroEstadoActual = null;

// ==========================================
// Inicialización y Autenticación
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  if (token) {
    showApp();
  } else {
    showLogin();
  }
});

function showLogin() {
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('appPage').style.display = 'none';
}

function showApp() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('appPage').style.display = 'flex';
  
  // Decodificar usuario desde token si es posible
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    document.getElementById('userName').textContent = payload.nombre;
    document.getElementById('userRole').textContent = payload.rol === 'admin' ? 'Administrador' : payload.rol === 'supervisor' ? 'Supervisor' : 'Visor';
    document.getElementById('userAvatar').textContent = payload.nombre.charAt(0).toUpperCase();
  } catch (e) {
    console.error('Error parseando token:', e);
  }

  initWebSocket();
  navigate(currentView);
}

async function login() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const errorDiv = document.getElementById('loginError');
  
  errorDiv.style.display = 'none';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (res.ok && data.exito) {
      token = data.token;
      localStorage.setItem('sia_token', token);
      showApp();
      showToast('Sesión iniciada correctamente', 'success');
    } else {
      errorDiv.textContent = data.error || 'Error al iniciar sesión';
      errorDiv.style.display = 'block';
    }
  } catch (e) {
    errorDiv.textContent = 'Error de conexión con el servidor';
    errorDiv.style.display = 'block';
  }
}

function logout() {
  localStorage.removeItem('sia_token');
  token = null;
  if (socket) socket.disconnect();
  showLogin();
}

// ==========================================
// WebSockets
// ==========================================
function initWebSocket() {
  socket = io();

  socket.on('connect', () => {
    console.log('Conectado a WebSocket');
  });

  socket.on('solicitud:nueva', (data) => {
    showToast(`Nueva solicitud recibida: Contrato ${data.contrato}`, 'info');
    if (currentView === 'dashboard' || currentView === 'solicitudes') {
      refreshData();
    }
  });

  socket.on('solicitud:updated', (data) => {
    showToast(`Solicitud #${data.solicitudId} cambió a: ${data.descripcion}`, 'info');
    if (currentView === 'dashboard' || currentView === 'solicitudes') {
      refreshData();
    }
    // Si estamos viendo los detalles de esta solicitud, recargar el modal/vista
    const modalBackdrop = document.getElementById('modalBackdrop');
    if (modalBackdrop.classList.contains('open') && window.currentSolicitudId === data.solicitudId) {
      verDetalle(data.solicitudId);
    }
  });

  socket.on('supervision:decision', (data) => {
    showToast(`Solicitud #${data.solicitudId} ${data.decision} por ${data.supervisor}`, 'warning');
    if (currentView === 'dashboard' || currentView === 'solicitudes') {
      refreshData();
    }
  });

  socket.on('worker:failed', (data) => {
    showToast(`Falla en cola [${data.queue}]: ${data.error}`, 'error');
    if (currentView === 'colas') {
      cargarColas();
    }
  });
}

// ==========================================
// Navegación y Rutas
// ==========================================
function navigate(view, element = null) {
  currentView = view;
  
  if (element) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    element.classList.add('active');
  }

  const titles = {
    'dashboard': 'Dashboard General',
    'solicitudes': 'Listado de Solicitudes',
    'colas': 'Monitoreo de Colas de Trabajo',
    'auditoria': 'Bitácora de Auditoría e Incidencias'
  };

  document.getElementById('pageTitle').textContent = titles[view] || 'SIA Observa';
  
  const contentArea = document.getElementById('contentArea');
  contentArea.innerHTML = '<div class="empty-state">Cargando...</div>';

  if (view === 'dashboard') {
    renderDashboard();
  } else if (view === 'solicitudes') {
    renderSolicitudes();
  } else if (view === 'colas') {
    renderColas();
  } else if (view === 'auditoria') {
    renderAuditoria();
  }
}

function refreshData() {
  if (currentView === 'dashboard') {
    cargarEstadisticas();
    cargarSolicitudesDashboard();
  } else if (currentView === 'solicitudes') {
    cargarSolicitudesListado();
  } else if (currentView === 'colas') {
    cargarColas();
  }
}

// ==========================================
// VISTA: Dashboard
// ==========================================
function renderDashboard() {
  const contentArea = document.getElementById('contentArea');
  contentArea.innerHTML = `
    <!-- Stats Grid -->
    <div class="stats-grid" id="statsGrid">
      <div class="stat-card">
        <div class="stat-label">Total Solicitudes</div>
        <div class="stat-value blue" id="statTotal">-</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Pendientes Aprobación</div>
        <div class="stat-value yellow" id="statPendientes">-</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">En Proceso</div>
        <div class="stat-value purple" id="statProceso">-</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Completadas</div>
        <div class="stat-value green" id="statCompletadas">-</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Fallas / Errores</div>
        <div class="stat-value red" id="statErrores">-</div>
      </div>
    </div>

    <!-- Sección Solicitudes Activas -->
    <div class="section">
      <div class="section-header">
        <div class="section-title">⚡ Acciones y Progreso Reciente</div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Contrato</th>
              <th>Contratista</th>
              <th>Progreso</th>
              <th>Estado</th>
              <th>Fecha Solicitud</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="dashboardSolicitudesTable">
            <tr><td colspan="7" class="empty-state">Buscando solicitudes...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
  refreshData();
}

async function cargarEstadisticas() {
  try {
    const res = await fetch('/api/estadisticas', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error();
    const result = await res.json();
    if (result.exito) {
      const stats = result.data;
      document.getElementById('statTotal').textContent = stats.total || 0;
      
      const pe = {};
      stats.porEstado.forEach(e => { pe[e.estado] = e.c; });

      const pendientes = pe.pendiente_aprobacion || 0;
      const proceso = (pe.descargando_secop || 0) + (pe.validando_pdfs || 0) + (pe.cargando_sia || 0) + (pe.extrayendo_datos || 0) + (pe.generando_certificado || 0);
      const completados = pe.finalizado || 0;
      const errores = pe.error || 0;

      document.getElementById('statPendientes').textContent = pendientes;
      document.getElementById('statProceso').textContent = proceso;
      document.getElementById('statCompletadas').textContent = completados;
      document.getElementById('statErrores').textContent = errores;
      
      // Actualizar badge en el menú
      const badge = document.getElementById('badgePendientes');
      if (pendientes > 0) {
        badge.textContent = pendientes;
        badge.style.display = 'block';
      } else {
        badge.style.display = 'none';
      }
    }
  } catch (e) {
    console.error('Error cargando stats:', e);
  }
}

async function cargarSolicitudesDashboard() {
  try {
    const res = await fetch('/api/solicitudes?limite=15', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error();
    const result = await res.json();
    if (result.exito) {
      const list = result.data.filter(s => s.estado !== 'finalizado');
      renderTablaSolicitudes(list, 'dashboardSolicitudesTable');
    }
  } catch (e) {
    console.error(e);
  }
}

// ==========================================
// VISTA: Solicitudes
// ==========================================
function renderSolicitudes() {
  const contentArea = document.getElementById('contentArea');
  contentArea.innerHTML = `
    <div class="section-header">
      <div class="section-title">📋 Todas las Solicitudes</div>
      <div class="filters">
        <button class="filter-btn active" onclick="filtrarSolicitudes(null, this)">Todas</button>
        <button class="filter-btn" onclick="filtrarSolicitudes('pendiente_aprobacion', this)">⏳ Pendientes</button>
        <button class="filter-btn" onclick="filtrarSolicitudes('pendiente_revision_certificado', this)">🔍 Por Revisar</button>
        <button class="filter-btn" onclick="filtrarSolicitudes('error', this)">❌ Errores</button>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Contrato</th>
            <th>Contratista</th>
            <th>Progreso</th>
            <th>Estado</th>
            <th>Fecha Solicitud</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="solicitudesListadoTable">
          <tr><td colspan="7" class="empty-state">Cargando solicitudes...</td></tr>
        </tbody>
      </table>
    </div>
  `;
  refreshData();
}

async function cargarSolicitudesListado() {
  try {
    const url = filtroEstadoActual 
      ? `/api/solicitudes?estado=${filtroEstadoActual}&limite=50`
      : '/api/solicitudes?limite=100';
      
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error();
    const result = await res.json();
    if (result.exito) {
      renderTablaSolicitudes(result.data, 'solicitudesListadoTable');
    }
  } catch (e) {
    console.error(e);
  }
}

function filtrarSolicitudes(estado, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filtroEstadoActual = estado;
  cargarSolicitudesListado();
}

// ==========================================
// RENDERIZADO DE TABLA COMÚN
// ==========================================
function renderTablaSolicitudes(solicitudes, targetElementId) {
  const tbody = document.getElementById(targetElementId);
  if (!solicitudes || solicitudes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No se encontraron solicitudes</td></tr>';
    return;
  }

  tbody.innerHTML = solicitudes.map(s => {
    const badgeClass = getBadgeClass(s.estado);
    const textEstado = formatEstado(s.estado);
    const fecha = new Date(s.fecha_solicitud).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
    const progress = s.progreso || 0;

    return `
      <tr>
        <td>${s.id}</td>
        <td><strong>${s.contrato}</strong></td>
        <td>${s.contratista}</td>
        <td style="width: 180px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:0.75rem;font-weight:600;min-width:28px">${progress}%</span>
            <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
          </div>
        </td>
        <td><span class="badge ${badgeClass}">${textEstado}</span></td>
        <td>${fecha}</td>
        <td class="actions">${getBotonesAccion(s)}</td>
      </tr>
    `;
  }).join('');
}

function getBadgeClass(estado) {
  if (estado.includes('pendiente') || estado.includes('esperando')) return 'badge-pending';
  if (estado.includes('error') || estado.includes('rechazado')) return 'badge-error';
  if (estado === 'finalizado') return 'badge-done';
  return 'badge-active';
}

function formatEstado(estado) {
  const map = {
    'pendiente_aprobacion': '⏳ Pend. Aprobación',
    'aprobado': '✅ Aprobado',
    'descargando_secop': '⬇️ Descargando SECOP',
    'descarga_completada': '📄 Descarga OK',
    'validando_pdfs': '📄 Validando PDFs',
    'pdfs_validados': '✅ PDFs Validados',
    'requiere_reescaneo': '⚠️ Requiere Re-escaneo',
    'cargando_sia': '⬆️ Cargando SIA',
    'carga_completada': '🔍 Verificar Carga',
    'carga_verificada': '🤖 Carga Verificada',
    'extrayendo_datos': '🤖 Extrayendo Datos',
    'datos_extraidos': '📝 Datos Listos',
    'generando_certificado': '📝 Generando Certificado',
    'certificado_generado': '🔍 Revisar Certificado',
    'certificado_aprobado': '✍️ Certificado Aprobado',
    'enviado_firma': '✉️ Enviado a Firma',
    'firmado': '📬 Certificado Firmado',
    'finalizado': '✅ Completado',
    'error': '❌ Fallido',
    'rechazado': '❌ Rechazado'
  };
  return map[estado] || estado;
}

function getBotonesAccion(s) {
  let html = `<button class="btn btn-outline" onclick="verDetalle(${s.id})">👁️ Detalle</button>`;
  
  if (s.estado === 'pendiente_aprobacion') {
    html += `<button class="btn btn-approve" onclick="abrirSupervision(${s.id}, 'aprobacion_solicitud')">Aprobar</button>`;
  } else if (s.estado === 'pendiente_verificacion_carga') {
    html += `<button class="btn btn-approve" onclick="abrirSupervision(${s.id}, 'verificacion_carga')">Verificar</button>`;
  } else if (s.estado === 'pendiente_revision_certificado') {
    html += `<button class="btn btn-approve" onclick="abrirSupervision(${s.id}, 'revision_certificado')">Revisar</button>`;
  }
  return html;
}

// ==========================================
// VISTA: Detalle y Aprobaciones
// ==========================================
window.currentSolicitudId = null;

async function verDetalle(id) {
  window.currentSolicitudId = id;
  
  try {
    const res = await fetch(`/api/solicitudes/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error();
    const result = await res.json();
    
    if (result.exito) {
      renderModalDetalle(result.data);
    }
  } catch (e) {
    showToast('Error cargando detalles', 'error');
  }
}

function renderModalDetalle(s) {
  const backdrop = document.getElementById('modalBackdrop');
  const modal = document.getElementById('modalContent');
  
  // Generar timeline de fases
  const timelineHtml = s.fases.map(f => {
    let statusClass = '';
    // Lógica simple para determinar estado visual de la fase
    if (s.fase_actual === f.id) statusClass = 'current';
    else if (s.estado === 'finalizado') statusClass = 'done';
    else {
      // Comparar orden de fases
      const faseActualConfig = s.fases.find(x => x.id === s.fase_actual);
      if (faseActualConfig && f.orden < faseActualConfig.orden) statusClass = 'done';
    }
    
    return `
      <div class="timeline-step ${statusClass}">
        <div class="timeline-dot">${f.icono}</div>
        <div class="timeline-label">${f.nombre}</div>
      </div>
    `;
  }).join('');

  modal.innerHTML = `
    <h3>📋 Solicitud #${s.id} — Contrato ${s.contrato}</h3>
    
    <!-- Timeline -->
    <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.25rem">LÍNEA DE TIEMPO DEL TRABAJO:</div>
    <div class="timeline">${timelineHtml}</div>

    <!-- Detalles del Contrato -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-top:1.5rem">
      <div>
        <h4 style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">INFORMACIÓN GENERAL</h4>
        <p style="margin-bottom:6px"><strong>Contratista:</strong> ${s.contratista}</p>
        <p style="margin-bottom:6px"><strong>Correo:</strong> ${s.correo_solicitante || '-'}</p>
        <p style="margin-bottom:6px"><strong>Pago / Acta:</strong> #${s.numero_pago || '-'}</p>
        <p style="margin-bottom:6px"><strong>Fecha Solicitud:</strong> ${new Date(s.fecha_solicitud).toLocaleString('es-CO')}</p>
      </div>
      <div>
        <h4 style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">DATOS EXTRAÍDOS POR IA</h4>
        ${s.datos_contrato ? `
          <p style="margin-bottom:6px"><strong>Tipo Contrato:</strong> ${s.tipo_persona === 'natural' ? 'Persona Natural' : 'Persona Jurídica'}</p>
          <p style="margin-bottom:6px"><strong>Código Proceso:</strong> ${s.datos_contrato.codigoProceso || '-'}</p>
          <p style="margin-bottom:6px"><strong>Identificación:</strong> ${s.datos_contrato.cedula || s.datos_contrato.nit || '-'}</p>
          <p style="margin-bottom:6px"><strong>Expedición:</strong> ${s.datos_contrato.expedicion || '-'}</p>
        ` : '<p style="color:var(--text-muted);font-style:italic">Esperando procesamiento de IA...</p>'}
      </div>
    </div>

    <!-- Registro de Fallas/Errores -->
    ${s.errores ? `
      <div style="background:var(--danger-dim);border:1px solid rgba(239,68,68,0.2);padding:10px;border-radius:8px;margin-top:1.5rem">
        <h4 style="color:var(--danger);font-size:0.8rem;margin-bottom:4px">⚠️ ERRORES REPORTADOS</h4>
        <pre style="font-size:0.75rem;white-space:pre-wrap;color:var(--text-1)">${s.errores}</pre>
      </div>
    ` : ''}

    <!-- Historial de Auditoría -->
    <div style="margin-top:1.5rem">
      <h4 style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">HISTORIAL DE LOGS (TRAZABILIDAD)</h4>
      <div style="max-height:120px;overflow-y:auto;background:var(--bg-3);border:1px solid var(--border);border-radius:8px;padding:8px">
        ${s.historial.map(h => {
          const colorNivel = h.nivel === 'error' ? 'var(--danger)' : h.nivel === 'success' ? 'var(--success)' : 'var(--text-muted)';
          return `<div style="font-size:0.7rem;margin-bottom:4px;color:var(--text-2)">
            <span style="color:${colorNivel}">[${h.nivel.toUpperCase()}]</span> 
            <span style="color:var(--text-3)">${new Date(h.timestamp).toLocaleTimeString()}</span> - 
            <strong>${h.workflow}</strong>: ${h.detalle}
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cerrar</button>
    </div>
  `;

  backdrop.classList.add('open');
}

function abrirSupervision(id, puntoControl) {
  window.currentSolicitudId = id;
  const backdrop = document.getElementById('modalBackdrop');
  const modal = document.getElementById('modalContent');

  const titulos = {
    'aprobacion_solicitud': 'Aprobar Inicio de Procesamiento',
    'verificacion_carga': 'Verificación de Carga en SIA Observa',
    'revision_certificado': 'Revisión y Aprobación del Certificado'
  };

  modal.innerHTML = `
    <h3>🔍 ${titulos[puntoControl] || 'Supervisión'}</h3>
    <p style="margin-bottom:1rem;font-size:0.85rem;color:var(--text-2)">Solicitud #${id}. Confirme si autoriza al agente a continuar con el siguiente paso.</p>
    
    <div class="form-group">
      <label>Comentario / Observación</label>
      <textarea id="comentarioSupervision" class="form-control" placeholder="Escriba algún comentario opcional..."></textarea>
    </div>

    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-reject" onclick="enviarDecision('${puntoControl}', 'rechazado')">Rechazar / Cancelar</button>
      <button class="btn btn-approve" onclick="enviarDecision('${puntoControl}', 'aprobado')">Aprobar y Continuar</button>
    </div>
  `;

  backdrop.classList.add('open');
}

async function enviarDecision(puntoControl, decision) {
  const comentario = document.getElementById('comentarioSupervision').value;
  const id = window.currentSolicitudId;

  try {
    const res = await fetch('/api/supervision/decidir', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        solicitudId: id,
        puntoControl,
        decision,
        comentario
      })
    });
    
    const data = await res.json();
    if (res.ok && data.exito) {
      showToast(`Solicitud #${id} marcada como: ${decision}`, 'success');
      closeModal();
      refreshData();
    } else {
      showToast(data.error || 'Error al guardar decisión', 'error');
    }
  } catch (e) {
    showToast('Error de comunicación', 'error');
  }
}

function closeModal() {
  document.getElementById('modalBackdrop').classList.remove('open');
}

// ==========================================
// VISTA: Colas de Trabajo (Workers)
// ==========================================
function renderColas() {
  const contentArea = document.getElementById('contentArea');
  contentArea.innerHTML = `
    <div class="section-header">
      <div class="section-title">⚙️ Estado de los Workers (BullMQ)</div>
    </div>
    <div class="stats-grid" id="colasGrid" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))">
      <div class="empty-state">Monitoreando servicios...</div>
    </div>
  `;
  refreshData();
}

async function cargarColas() {
  try {
    const res = await fetch('/api/colas', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error();
    const result = await res.json();
    
    if (result.exito) {
      const colasGrid = document.getElementById('colasGrid');
      colasGrid.innerHTML = Object.values(result.data).map(c => {
        const isOffline = c.total === 0 && c.active === 0;
        const colorCard = isOffline ? 'border-color:rgba(239,68,68,0.2)' : 'border-color:rgba(16,185,129,0.2)';
        
        return `
          <div class="stat-card" style="${colorCard}">
            <div style="display:flex;justify-content:between;align-items:center;margin-bottom:8px">
              <span style="font-weight:600;font-size:0.85rem">${c.nombre}</span>
              <span class="badge ${isOffline ? 'badge-error' : 'badge-done'}" style="margin-left:auto;font-size:0.6rem">
                ${isOffline ? 'INACTIVO' : 'ACTIVO'}
              </span>
            </div>
            <div style="font-size:0.7rem;color:var(--text-3);margin-bottom:1rem">${c.descripcion}</div>
            
            <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;text-align:center">
              <div style="background:var(--bg-3);padding:4px;border-radius:4px">
                <div style="font-size:0.6rem;color:var(--text-3)">Activos</div>
                <div style="font-weight:700;font-size:1rem;color:var(--accent)">${c.active}</div>
              </div>
              <div style="background:var(--bg-3);padding:4px;border-radius:4px">
                <div style="font-size:0.6rem;color:var(--text-3)">Espera</div>
                <div style="font-weight:700;font-size:1rem;color:var(--warning)">${c.waiting}</div>
              </div>
              <div style="background:var(--bg-3);padding:4px;border-radius:4px">
                <div style="font-size:0.6rem;color:var(--text-3)">Fallidos</div>
                <div style="font-weight:700;font-size:1rem;color:var(--danger)">${c.failed}</div>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (e) {
    console.error(e);
  }
}

// ==========================================
// VISTA: Auditoría
// ==========================================
function renderAuditoria() {
  const contentArea = document.getElementById('contentArea');
  contentArea.innerHTML = `
    <div class="section-header">
      <div class="section-title">📜 Trazabilidad de Auditoría e Incidentes</div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Fecha y Hora</th>
            <th>Nivel</th>
            <th>Módulo</th>
            <th>Evento</th>
            <th>Detalle del Proceso</th>
          </tr>
        </thead>
        <tbody id="auditoriaTable">
          <tr><td colspan="5" class="empty-state">Buscando logs de auditoría...</td></tr>
        </tbody>
      </table>
    </div>
  `;
  cargarAuditoria();
}

async function cargarAuditoria() {
  try {
    const res = await fetch('/api/auditoria?limite=100', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error();
    const result = await res.json();
    
    if (result.exito) {
      const tbody = document.getElementById('auditoriaTable');
      if (!result.data || result.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No hay registros de auditoría</td></tr>';
        return;
      }
      
      tbody.innerHTML = result.data.map(a => {
        const badgeClass = a.nivel === 'error' ? 'badge-error' : a.nivel === 'success' ? 'badge-done' : a.nivel === 'warn' ? 'badge-pending' : 'badge-active';
        return `
          <tr>
            <td style="font-size:0.75rem;color:var(--text-3)">${new Date(a.timestamp).toLocaleString('es-CO')}</td>
            <td><span class="badge ${badgeClass}" style="font-size:0.6rem">${a.nivel.toUpperCase()}</span></td>
            <td><strong>${a.workflow}</strong></td>
            <td><code>${a.evento}</code></td>
            <td style="color:var(--text-1)">${a.detalle}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (e) {
    console.error(e);
  }
}

// ==========================================
// UTILS: Toast notifications
// ==========================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
