import { api } from './api.js';
import { enqueue } from './db.js';
import { uploadToCloudinary } from './cloudinary.js';

function showToast(msg, type) {
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { msg, type } }));
}

export function renderMascotasView() {
  return `
    <div class="view-header">
      <h2><i class="fa-solid fa-paw"></i> Mascotas</h2>
      <button class="btn btn-primary" id="btn-nueva-mascota">
        <i class="fa-solid fa-plus"></i> Nueva
      </button>
    </div>

    <!-- Modal registro / edición -->
    <div id="modal-mascota" class="modal hidden">
      <div class="modal-backdrop"></div>
      <div class="modal-box">
        <div class="modal-header">
          <h3 id="modal-mascota-title"><i class="fa-solid fa-paw"></i> Registrar mascota</h3>
          <button class="modal-close" id="btn-close-modal"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <form id="form-mascota" novalidate>

          <!-- Foto -->
          <div class="field-group">
            <label><i class="fa-solid fa-image"></i> Foto de la mascota</label>
            <div class="foto-upload-area" id="m-foto-drop">
              <i class="fa-solid fa-camera fa-2x"></i>
              <p>Toca para seleccionar foto</p>
              <input type="file" id="m-foto-input" accept="image/*" style="display:none" />
            </div>
            <div id="m-foto-preview-wrap" class="hidden" style="margin-top:.5rem;position:relative">
              <img id="m-foto-preview" alt="Vista previa"
                style="width:100%;max-height:180px;object-fit:cover;border-radius:var(--radius-md);" />
              <button type="button" id="btn-m-remove-foto"
                style="position:absolute;top:.4rem;right:.4rem;background:rgba(0,0,0,.55);color:#fff;border-radius:50%;width:28px;height:28px;font-size:.8rem;display:flex;align-items:center;justify-content:center">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
            <p id="m-foto-status" class="text-muted" style="font-size:.8rem;margin-top:.3rem"></p>
          </div>

          <div class="form-grid-2">
            <div class="field-group">
              <label for="m-nombre"><i class="fa-solid fa-tag"></i> Nombre</label>
              <input type="text" id="m-nombre" placeholder="Firulais" required />
            </div>
            <div class="field-group">
              <label for="m-tipo"><i class="fa-solid fa-paw"></i> Tipo</label>
              <select id="m-tipo" required>
                <option value="">Seleccionar</option>
                <option value="PERRO">Perro</option>
                <option value="GATO">Gato</option>
                <option value="PAJARO">Pájaro</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>
            <div class="field-group">
              <label for="m-edad"><i class="fa-solid fa-calendar-days"></i> Edad (años)</label>
              <input type="number" id="m-edad" min="0" max="30" placeholder="3" required />
            </div>
            <div class="field-group">
              <label for="m-genero"><i class="fa-solid fa-venus-mars"></i> Género</label>
              <select id="m-genero" required>
                <option value="">Seleccionar</option>
                <option value="MACHO">Macho</option>
                <option value="HEMBRA">Hembra</option>
              </select>
            </div>
          </div>

          <div id="mascota-error" class="alert alert-error hidden"></div>
          <button type="submit" class="btn btn-primary btn-full" id="btn-submit-mascota">
            <i class="fa-solid fa-floppy-disk"></i> Guardar mascota
          </button>
        </form>
      </div>
    </div>

    <!-- Modal confirmar borrar -->
    <div id="modal-borrar" class="modal hidden">
      <div class="modal-backdrop"></div>
      <div class="modal-box" style="max-width:360px">
        <div class="modal-header">
          <h3><i class="fa-solid fa-trash"></i> Confirmar</h3>
          <button class="modal-close" id="btn-close-borrar"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <p style="margin:.5rem 0 1.25rem">¿Seguro que deseas eliminar esta mascota?</p>
        <div style="display:flex;gap:.75rem">
          <button class="btn btn-danger btn-full" id="btn-confirm-borrar">
            <i class="fa-solid fa-trash"></i> Eliminar
          </button>
          <button class="btn btn-outline btn-full" id="btn-cancel-borrar">Cancelar</button>
        </div>
      </div>
    </div>

    <div id="mascotas-grid" class="mascotas-grid">
      <div class="loading-inline"><i class="fa-solid fa-spinner fa-spin"></i> Cargando...</div>
    </div>`;
}

export async function initMascotasView() {
  await loadMascotas();
  setupModal();
}

async function loadMascotas() {
  const grid = document.getElementById('mascotas-grid');
  if (!grid) return;
  try {
    const mascotas = await api.get('/mascotas');
    if (!mascotas.length) {
      grid.innerHTML = '<p class="empty-state"><i class="fa-solid fa-paw"></i> No hay mascotas registradas aún.</p>';
      return;
    }
    grid.innerHTML = mascotas.map(m => `
      <div class="mascota-card">
        ${m.fotografia
          ? `<img src="${esc(m.fotografia)}" alt="${esc(m.nombre)}" class="mascota-card-img" onerror="this.style.display='none'" />`
          : `<div class="mascota-card-img" style="display:flex;align-items:center;justify-content:center">${tipoIcon(m.tipo, '3rem')}</div>`
        }
        <div class="mascota-card-body">
          <p class="mascota-card-name">${esc(m.nombre)}</p>
          <p class="mascota-card-meta">
            <span class="badge badge-primary">${esc(m.tipo)}</span>
          </p>
          <p class="mascota-card-meta" style="margin-top:.35rem">
            <i class="fa-solid fa-calendar-days"></i> ${esc(m.edad)} año${m.edad !== 1 ? 's' : ''}
            &nbsp;·&nbsp;
            <i class="fa-solid fa-venus-mars"></i> ${esc(m.genero)}
          </p>
        </div>
        <div class="mascota-card-footer">
          <button class="btn btn-outline btn-sm" style="flex:1" data-id="${esc(m.id)}" data-action="editar"
            data-nombre="${esc(m.nombre)}" data-tipo="${esc(m.tipo)}" data-edad="${esc(m.edad)}"
            data-genero="${esc(m.genero)}" data-foto="${esc(m.fotografia || '')}">
            <i class="fa-solid fa-pen"></i> Editar
          </button>
          <button class="btn btn-danger btn-sm" style="flex:1" data-id="${esc(m.id)}" data-action="borrar">
            <i class="fa-solid fa-trash"></i> Borrar
          </button>
        </div>
      </div>`).join('');

    grid.addEventListener('click', onCardAction);
  } catch (err) {
    grid.innerHTML = `<p class="alert alert-error">${esc(err.message)}</p>`;
  }
}

function onCardAction(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  if (btn.dataset.action === 'editar') openEditModal(btn.dataset);
  if (btn.dataset.action === 'borrar') openBorrarModal(btn.dataset.id);
}

// ── Modal registro/edición ─────────────────────────────────────────────────

let _editingId = null;
let _currentFotoFile = null;

function setupModal() {
  const modal    = document.getElementById('modal-mascota');
  const btnOpen  = document.getElementById('btn-nueva-mascota');
  const btnClose = document.getElementById('btn-close-modal');
  const backdrop = modal?.querySelector('.modal-backdrop');
  const form     = document.getElementById('form-mascota');
  const fotoDrop = document.getElementById('m-foto-drop');
  const fotoInput= document.getElementById('m-foto-input');
  const rmFoto   = document.getElementById('btn-m-remove-foto');

  btnOpen?.addEventListener('click', () => {
    _editingId = null;
    _currentFotoFile = null;
    form?.reset();
    clearMFoto();
    document.getElementById('modal-mascota-title').innerHTML = '<i class="fa-solid fa-paw"></i> Registrar mascota';
    modal.classList.remove('hidden');
  });
  btnClose?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);

  fotoDrop?.addEventListener('click', () => fotoInput?.click());
  fotoInput?.addEventListener('change', () => {
    if (fotoInput.files[0]) {
      _currentFotoFile = fotoInput.files[0];
      const url = URL.createObjectURL(_currentFotoFile);
      document.getElementById('m-foto-preview').src = url;
      document.getElementById('m-foto-preview-wrap').classList.remove('hidden');
    }
  });
  rmFoto?.addEventListener('click', () => { _currentFotoFile = null; clearMFoto(); });

  form?.addEventListener('submit', handleSubmit);
}

function clearMFoto() {
  document.getElementById('m-foto-preview-wrap')?.classList.add('hidden');
  document.getElementById('m-foto-status').textContent = '';
  const input = document.getElementById('m-foto-input');
  if (input) input.value = '';
}

function openEditModal(data) {
  _editingId = data.id;
  _currentFotoFile = null;
  document.getElementById('modal-mascota-title').innerHTML = '<i class="fa-solid fa-pen"></i> Editar mascota';
  document.getElementById('m-nombre').value = data.nombre || '';
  document.getElementById('m-tipo').value   = data.tipo   || '';
  document.getElementById('m-edad').value   = data.edad   || '';
  document.getElementById('m-genero').value = data.genero || '';

  if (data.foto) {
    const img  = document.getElementById('m-foto-preview');
    img.src    = data.foto;
    document.getElementById('m-foto-preview-wrap').classList.remove('hidden');
  } else {
    clearMFoto();
  }

  document.getElementById('modal-mascota').classList.remove('hidden');
}

async function handleSubmit(e) {
  e.preventDefault();
  const errDiv  = document.getElementById('mascota-error');
  const statusEl= document.getElementById('m-foto-status');
  errDiv.classList.add('hidden');
  const btn = document.getElementById('btn-submit-mascota');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando…';

  try {
    // Subir foto si hay una nueva (opcional — si falla no bloquea el guardado)
    let fotografia;
    if (_currentFotoFile) {
      statusEl.textContent = 'Subiendo foto…';
      try {
        fotografia = await uploadToCloudinary(_currentFotoFile);
        statusEl.textContent = '';
      } catch (uploadErr) {
        statusEl.textContent = '';
        errDiv.textContent = uploadErr.message;
        errDiv.classList.remove('hidden');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar mascota';
        return;
      }
    } else {
      // conservar la foto existente (en edición)
      fotografia = document.getElementById('m-foto-preview').src || undefined;
      if (fotografia && (fotografia.startsWith('blob:') || fotografia.startsWith('data:'))) {
        fotografia = undefined;
      }
    }

    const dto = {
      nombre: document.getElementById('m-nombre').value.trim(),
      tipo:   document.getElementById('m-tipo').value,
      genero: document.getElementById('m-genero').value,
      edad:   Number(document.getElementById('m-edad').value),
      ...(fotografia && { fotografia }),
    };

    if (navigator.onLine) {
      if (_editingId) {
        await api.patch(`/mascotas/${_editingId}`, dto);
        showToast('Mascota actualizada', 'success');
      } else {
        await api.post('/mascotas', dto);
        showToast('Mascota registrada', 'success');
      }
    } else {
      await enqueue('mascotas_queue', dto);
      showToast('Sin conexión — guardado localmente', 'warning');
    }

    closeModal();
    document.getElementById('form-mascota').reset();
    clearMFoto();
    _editingId = null;
    _currentFotoFile = null;
    await loadMascotas();
  } catch (err) {
    errDiv.textContent = err.message;
    errDiv.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar mascota';
  }
}

function closeModal() {
  document.getElementById('modal-mascota')?.classList.add('hidden');
  document.getElementById('mascota-error')?.classList.add('hidden');
}

// ── Modal borrar ────────────────────────────────────────────────────────────

let _deletingId = null;

function openBorrarModal(id) {
  _deletingId = id;
  const modal = document.getElementById('modal-borrar');
  modal.classList.remove('hidden');

  document.getElementById('btn-close-borrar').onclick  = closeBorrarModal;
  document.getElementById('btn-cancel-borrar').onclick = closeBorrarModal;
  modal.querySelector('.modal-backdrop').onclick       = closeBorrarModal;
  document.getElementById('btn-confirm-borrar').onclick = confirmBorrar;
}

function closeBorrarModal() {
  document.getElementById('modal-borrar')?.classList.add('hidden');
  _deletingId = null;
}

async function confirmBorrar() {
  if (!_deletingId) return;
  const btn = document.getElementById('btn-confirm-borrar');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Eliminando…';
  try {
    await api.delete(`/mascotas/${_deletingId}`);
    showToast('Mascota eliminada', 'success');
    closeBorrarModal();
    await loadMascotas();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-trash"></i> Eliminar';
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function tipoIcon(tipo, size = '1.4rem') {
  const icons = {
    PERRO:  'fa-dog',
    GATO:   'fa-cat',
    PAJARO: 'fa-feather',
  };
  const cls = icons[tipo] || 'fa-paw';
  return `<i class="fa-solid ${cls}" style="font-size:${size};color:var(--primary-border)"></i>`;
}

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
