import { api } from './api.js';

function showToast(msg, type) {
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { msg, type } }));
}

export function renderPersonasView() {
  return `
    <div class="view-header">
      <h2><i class="fa-solid fa-users"></i> Personas registradas</h2>
      <button class="btn btn-primary" id="btn-nueva-persona">
        <i class="fa-solid fa-user-plus"></i> Nueva
      </button>
    </div>

    <!-- Modal nueva persona -->
    <div id="modal-persona" class="modal hidden">
      <div class="modal-backdrop"></div>
      <div class="modal-box">
        <div class="modal-header">
          <h3><i class="fa-solid fa-user-plus"></i> Nueva persona</h3>
          <button class="modal-close" id="btn-close-persona-modal"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <form id="form-nueva-persona" novalidate>
          <div class="persona-form-grid">
            <div class="field-group">
              <label for="p-nombres"><i class="fa-solid fa-user"></i> Nombres</label>
              <input type="text" id="p-nombres" placeholder="Juan Carlos" required />
            </div>
            <div class="field-group">
              <label for="p-apellidos"><i class="fa-solid fa-user"></i> Apellidos</label>
              <input type="text" id="p-apellidos" placeholder="Pérez García" required />
            </div>
            <div class="field-group">
              <label for="p-tipo-doc"><i class="fa-solid fa-id-card"></i> Tipo doc.</label>
              <select id="p-tipo-doc" required>
                <option value="">Seleccionar</option>
                <option value="CC">CC</option>
                <option value="CE">CE</option>
                <option value="TI">TI</option>
                <option value="PA">Pasaporte</option>
              </select>
            </div>
            <div class="field-group">
              <label for="p-documento"><i class="fa-solid fa-hashtag"></i> Documento</label>
              <input type="text" id="p-documento" placeholder="1234567890" required />
            </div>
            <div class="field-group">
              <label for="p-telefono"><i class="fa-solid fa-phone"></i> Teléfono</label>
              <input type="tel" id="p-telefono" placeholder="3001234567" required />
            </div>
            <div class="field-group">
              <label for="p-ciudad"><i class="fa-solid fa-city"></i> Ciudad</label>
              <input type="text" id="p-ciudad" placeholder="Bogotá" required />
            </div>
          </div>
          <div class="field-group">
            <label for="p-direccion"><i class="fa-solid fa-map-marker-alt"></i> Dirección</label>
            <input type="text" id="p-direccion" placeholder="Calle Principal 123" required />
          </div>
          <div class="persona-form-grid" style="margin-top:.25rem">
            <div class="field-group">
              <label for="p-usuario"><i class="fa-solid fa-at"></i> Usuario</label>
              <input type="text" id="p-usuario" placeholder="nombre_usuario" autocomplete="username" required />
            </div>
            <div class="field-group">
              <label for="p-contrasena"><i class="fa-solid fa-lock"></i> Contraseña</label>
              <div class="input-password-wrapper">
                <input type="password" id="p-contrasena" placeholder="Mínimo 6 caracteres" autocomplete="new-password" required />
                <button type="button" class="toggle-password" tabindex="-1">
                  <i class="fa-solid fa-eye"></i>
                </button>
              </div>
            </div>
          </div>
          <div id="persona-modal-error" class="alert alert-error hidden"></div>
          <button type="submit" class="btn btn-primary btn-full" id="btn-submit-persona">
            <i class="fa-solid fa-floppy-disk"></i> Guardar persona
          </button>
        </form>
      </div>
    </div>

    <div id="personas-list">
      <div class="loading-inline"><i class="fa-solid fa-spinner fa-spin"></i> Cargando...</div>
    </div>`;
}

export async function initPersonasView() {
  await loadPersonas();
  setupPersonaModal();
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

    // Desktop: tabla | Mobile: cards (se maneja con CSS + data-label)
    container.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table personas-table">
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
                <td data-label="Nombres">${esc(p.nombres)}</td>
                <td data-label="Apellidos">${esc(p.apellidos)}</td>
                <td data-label="Documento"><span class="badge">${esc(p.tipoDocumento)}</span> ${esc(p.documento)}</td>
                <td data-label="Teléfono">${esc(p.telefono)}</td>
                <td data-label="Ciudad">${esc(p.ciudad)}</td>
                <td data-label="Usuario"><code>${esc(p.usuario || '—')}</code></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (err) {
    container.innerHTML = `<p class="alert alert-error">${esc(err.message)}</p>`;
  }
}

// ── Modal nueva persona ────────────────────────────────────────────────────

function setupPersonaModal() {
  const modal    = document.getElementById('modal-persona');
  const btnOpen  = document.getElementById('btn-nueva-persona');
  const btnClose = document.getElementById('btn-close-persona-modal');
  const backdrop = modal?.querySelector('.modal-backdrop');
  const form     = document.getElementById('form-nueva-persona');

  btnOpen?.addEventListener('click', () => {
    form?.reset();
    document.getElementById('persona-modal-error')?.classList.add('hidden');
    modal.classList.remove('hidden');
  });

  // Toggle password visibility
  modal?.querySelector('.toggle-password')?.addEventListener('click', () => {
    const inp = document.getElementById('p-contrasena');
    const icon = modal.querySelector('.toggle-password i');
    if (inp.type === 'password') {
      inp.type = 'text';
      icon.className = 'fa-solid fa-eye-slash';
    } else {
      inp.type = 'password';
      icon.className = 'fa-solid fa-eye';
    }
  });

  btnClose?.addEventListener('click', closePersonaModal);
  backdrop?.addEventListener('click', closePersonaModal);

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errDiv = document.getElementById('persona-modal-error');
    errDiv.classList.add('hidden');
    const btn = document.getElementById('btn-submit-persona');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando…';

    const dto = {
      nombres:       document.getElementById('p-nombres').value.trim(),
      apellidos:     document.getElementById('p-apellidos').value.trim(),
      tipoDocumento: document.getElementById('p-tipo-doc').value,
      documento:     document.getElementById('p-documento').value.trim(),
      telefono:      document.getElementById('p-telefono').value.trim(),
      ciudad:        document.getElementById('p-ciudad').value.trim(),
      direccion:     document.getElementById('p-direccion').value.trim(),
      usuario:       document.getElementById('p-usuario').value.trim(),
      contrasena:    document.getElementById('p-contrasena').value,
    };

    try {
      // Usar /personas/registro (igual que el flujo de auto-registro)
      // para evitar conflictos 409 con el endpoint /personas
      await api.post('/personas/registro', dto);
      showToast('Persona registrada correctamente', 'success');
      closePersonaModal();
      await loadPersonas();
    } catch (err) {
      errDiv.textContent = err.message;
      errDiv.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar persona';
    }
  });
}

function closePersonaModal() {
  document.getElementById('modal-persona')?.classList.add('hidden');
}

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
