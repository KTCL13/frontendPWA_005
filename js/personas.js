import { api } from './api.js';

export function renderPersonasView() {
  return `
    <div class="view-header">
      <h2><i class="fa-solid fa-users"></i> Personas registradas</h2>
    </div>
    <div id="personas-list" class="table-wrapper">
      <div class="loading-inline"><i class="fa-solid fa-spinner fa-spin"></i> Cargando...</div>
    </div>`;
}

export async function initPersonasView() {
  await loadPersonas();
}

async function loadPersonas() {
  const container = document.getElementById('personas-list');
  if (!container) return;

  try {
    const personas = await api.get('/personas');
    if (!personas.length) {
      container.innerHTML = '<p class="empty-state"><i class="fa-solid fa-users-slash"></i> No hay personas registradas.</p>';
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Nombres</th>
            <th>Apellidos</th>
            <th>Documento</th>
            <th>Teléfono</th>
            <th>Ciudad</th>
            <th>Usuario</th>
          </tr>
        </thead>
        <tbody>
          ${personas.map(p => `
            <tr>
              <td>${esc(p.nombres)}</td>
              <td>${esc(p.apellidos)}</td>
              <td><span class="badge">${esc(p.tipoDocumento)}</span> ${esc(p.documento)}</td>
              <td>${esc(p.telefono)}</td>
              <td>${esc(p.ciudad)}</td>
              <td><code>${esc(p.usuario)}</code></td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (err) {
    container.innerHTML = `<p class="alert alert-error">${esc(err.message)}</p>`;
  }
}

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
