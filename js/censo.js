import { api } from './api.js';
import { enqueue } from './db.js';

function showToast(msg, type) {
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { msg, type } }));
}

function getSessionProjectId() {
  let id = sessionStorage.getItem('censo_proyecto');
  if (!id) {
    id = 'CENSO_' + Date.now().toString(36).toUpperCase();
    sessionStorage.setItem('censo_proyecto', id);
  }
  return id;
}

const COLOR_PALETTE = ['#A80081','#0077CC','#2E7D32','#E65100','#6A1B9A','#00838F','#AD1457'];
function getSessionColor() {
  let color = sessionStorage.getItem('censo_color');
  if (!color) {
    color = COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
    sessionStorage.setItem('censo_color', color);
  }
  return color;
}

export function renderCensoView() {
  return `
    <div class="view-header">
      <h2><i class="fa-solid fa-clipboard-list"></i> Nuevo Censo</h2>
    </div>
    <div class="card">
      <form id="form-censo" novalidate>

        <div class="field-group">
          <label><i class="fa-solid fa-camera"></i> Fotografía de la mascota</label>
          <div class="foto-upload-area" id="foto-drop">
            <i class="fa-solid fa-camera fa-2x"></i>
            <p>Toca para abrir la cámara o seleccionar foto</p>
            <input type="file" id="censo-foto" accept="image/*" capture="environment" style="display:none" />
          </div>
          <div id="foto-preview-wrap" class="hidden" style="margin-top:.5rem;position:relative">
            <img id="foto-preview" alt="Vista previa"
              style="width:100%;max-height:220px;object-fit:cover;border-radius:var(--radius-md);" />
            <button type="button" id="btn-remove-foto"
              style="position:absolute;top:.4rem;right:.4rem;background:rgba(0,0,0,.55);color:#fff;border-radius:50%;width:28px;height:28px;font-size:.8rem;display:flex;align-items:center;justify-content:center">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <p id="foto-size-info" class="text-muted" style="font-size:.78rem;margin-top:.3rem"></p>
          <p id="foto-error" class="alert alert-error hidden"></p>
        </div>

        <div class="form-grid-2">
          <div class="field-group">
            <label for="censo-mascota"><i class="fa-solid fa-paw"></i> Mascota</label>
            <select id="censo-mascota" required>
              <option value="">Cargando…</option>
            </select>
          </div>
          <div class="field-group">
            <label for="censo-dueno"><i class="fa-solid fa-user"></i> Dueño</label>
            <select id="censo-dueno" required>
              <option value="">Cargando…</option>
            </select>
          </div>
        </div>

        <div class="field-group">
          <label><i class="fa-solid fa-location-dot"></i> Geolocalización</label>
          <div class="geo-status" id="geo-status">
            <i class="fa-solid fa-location-crosshairs"></i>
            <span>Se capturará al enviar el formulario</span>
          </div>
        </div>

        <div id="censo-error" class="alert alert-error hidden"></div>
        <div id="censo-success" class="alert alert-success hidden"></div>

        <button type="submit" class="btn btn-primary btn-full" id="btn-submit-censo">
          <i class="fa-solid fa-paper-plane"></i> Registrar censo
        </button>
      </form>
    </div>`;
}

export async function initCensoView() {
  setupPhotoInput();
  await loadSelects();
  setupForm();
}

// ── Foto ──────────────────────────────────────────────────────────────────────

let _fotoBase64 = null;

function setupPhotoInput() {
  const drop  = document.getElementById('foto-drop');
  const input = document.getElementById('censo-foto');
  const rmBtn = document.getElementById('btn-remove-foto');

  drop?.addEventListener('click', () => input?.click());
  input?.addEventListener('change', () => {
    if (input.files[0]) processPhoto(input.files[0]);
  });
  rmBtn?.addEventListener('click', clearPhoto);
}

function processPhoto(file) {
  const errEl    = document.getElementById('foto-error');
  const sizeInfo = document.getElementById('foto-size-info');
  errEl.classList.add('hidden');

  const reader = new FileReader();
  reader.onload = (e) => {
    const base64 = e.target.result;
    const raw = base64.split(',')[1] || '';
    const kb = (raw.length * 0.75 / 1024).toFixed(1);
    sizeInfo.textContent = `Tamaño: ${kb} KB`;

    _fotoBase64 = base64;
    document.getElementById('foto-preview').src = base64;
    document.getElementById('foto-preview-wrap').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function clearPhoto() {
  _fotoBase64 = null;
  document.getElementById('foto-preview').src = '';
  document.getElementById('foto-preview-wrap').classList.add('hidden');
  document.getElementById('foto-size-info').textContent = '';
  document.getElementById('censo-foto').value = '';
  document.getElementById('foto-error').classList.add('hidden');
}

// ── Selects ───────────────────────────────────────────────────────────────────

async function loadSelects() {
  try {
    const [mascotas, personas] = await Promise.all([
      api.get('/mascotas'),
      api.get('/personas'),
    ]);
    fillSelect('censo-mascota', mascotas, m => ({ value: m.id, label: `${m.nombre} (${m.tipo})` }));
    fillSelect('censo-dueno',   personas, p => ({ value: p.id, label: `${p.nombres} ${p.apellidos}` }));
  } catch (err) {
    showToast('No se pudo cargar mascotas o personas: ' + err.message, 'error');
  }
}

function fillSelect(id, items, mapper) {
  const sel = document.getElementById(id);
  if (!sel) return;
  sel.innerHTML = '<option value="">Seleccionar…</option>' +
    items.map(i => {
      const { value, label } = mapper(i);
      return `<option value="${esc(value)}">${esc(label)}</option>`;
    }).join('');
}

// ── Form submit ───────────────────────────────────────────────────────────────

function setupForm() {
  const form = document.getElementById('form-censo');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errDiv = document.getElementById('censo-error');
    const sucDiv = document.getElementById('censo-success');
    errDiv.classList.add('hidden');
    sucDiv.classList.add('hidden');

    if (!_fotoBase64) {
      errDiv.textContent = 'Debes tomar o seleccionar una fotografía.';
      errDiv.classList.remove('hidden');
      return;
    }

    const idMascota = document.getElementById('censo-mascota').value;
    const idDueno   = document.getElementById('censo-dueno').value;
    if (!idMascota || !idDueno) {
      errDiv.textContent = 'Debes seleccionar la mascota y el dueño.';
      errDiv.classList.remove('hidden');
      return;
    }

    const btn = document.getElementById('btn-submit-censo');
    btn.disabled = true;

    const geoStatus = document.getElementById('geo-status');
    geoStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Obteniendo ubicación…';
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Obteniendo ubicación…';

    let lat, lon;
    try {
      ({ lat, lon } = await getGeolocation());
      geoStatus.innerHTML = `<i class="fa-solid fa-location-dot"></i> ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    } catch {
      geoStatus.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Ubicación no disponible';
      errDiv.textContent = 'No se pudo obtener la ubicación GPS. Activa los permisos de localización e inténtalo de nuevo.';
      errDiv.classList.remove('hidden');
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Registrar censo';
      return;
    }

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando…';

    const dto = {
      fotografia: _fotoBase64,
      idMascota,
      idDueno,
      idProyecto: getSessionProjectId(),
      color:      getSessionColor(),
      lat,
      lon,
    };

    try {
      if (navigator.onLine) {
        await api.post('/censos', dto);
        sucDiv.textContent = 'Censo registrado correctamente.';
        sucDiv.classList.remove('hidden');
        showToast('Censo registrado', 'success');
        form.reset();
        clearPhoto();
        geoStatus.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Se capturará al enviar el formulario';
      } else {
        await enqueue('censos_queue', dto);
        sucDiv.textContent = 'Sin conexión — censo guardado localmente.';
        sucDiv.classList.remove('hidden');
        showToast('Guardado sin conexión', 'warning');
      }
    } catch (err) {
      errDiv.textContent = err.message;
      errDiv.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Registrar censo';
    }
  });
}

function getGeolocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('No disponible')); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      { timeout: 10000, maximumAge: 0 }
    );
  });
}

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
