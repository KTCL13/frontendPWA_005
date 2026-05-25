const BASE_URL = 'https://elprofehugo.online/api/v1';

export async function apiFetch(method, path, body = null) {
  const token = localStorage.getItem('jwt_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = { method, headers };
  if (body !== null) options.body = JSON.stringify(body);

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, options);
  } catch {
    throw new Error('Sin conexión al servidor');
  }

  if (response.status === 401) {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('jwt_expires');
    localStorage.removeItem('current_user');
    window.location.hash = '#/login';
    throw new Error('Sesión expirada. Por favor inicia sesión de nuevo.');
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!response.ok) {
    const msg = (data && (data.message || data.error)) || `Error ${response.status}`;
    throw new Error(Array.isArray(msg) ? msg.join(', ') : msg);
  }

  return data;
}

export const api = {
  get:    (path)        => apiFetch('GET',    path),
  post:   (path, body)  => apiFetch('POST',   path, body),
  patch:  (path, body)  => apiFetch('PATCH',  path, body),
  delete: (path)        => apiFetch('DELETE', path),
};
