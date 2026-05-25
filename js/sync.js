import { api } from './api.js';
import { getQueue, clearItem } from './db.js';

function toast(msg, type) {
  window.dispatchEvent(new CustomEvent('app:toast', { detail: { msg, type } }));
}

async function drainQueue(store, endpoint) {
  const items = await getQueue(store);
  let synced = 0;
  for (const item of items) {
    const { id, _queuedAt, ...data } = item;
    try {
      await api.post(endpoint, data);
      await clearItem(store, id);
      synced++;
    } catch {
      // leave in queue if still failing
    }
  }
  return synced;
}

export async function syncAll() {
  if (!navigator.onLine) return;

  const results = await Promise.all([
    drainQueue('personas_queue', '/personas'),
    drainQueue('mascotas_queue', '/mascotas'),
    drainQueue('censos_queue', '/censos'),
  ]);

  const total = results.reduce((a, b) => a + b, 0);
  if (total > 0) {
    toast(`${total} registro${total > 1 ? 's' : ''} sincronizado${total > 1 ? 's' : ''}`, 'success');
  }
  return total;
}

export function initSync() {
  window.addEventListener('online', () => {
    toast('Conexión restaurada — sincronizando…', 'info');
    syncAll();
  });
}
