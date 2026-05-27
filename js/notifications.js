import { api } from './api.js';
import { isLoggedIn } from './auth.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

async function getOrCreateSubscription() {
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  const { publicKey } = await api.get('/push/key');
  if (!publicKey) throw new Error('No se obtuvo la clave pública VAPID');

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
}

export async function subscribeToNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Este navegador no soporta notificaciones push');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permiso de notificaciones denegado');
  }

  const subscription = await getOrCreateSubscription();
  await api.post('/push/subscriptions', subscription.toJSON());
  localStorage.setItem('push_subscribed', '1');
  return subscription;
}

export async function unsubscribeFromNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Este navegador no soporta notificaciones push');
  }
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await subscription.unsubscribe();
  localStorage.removeItem('push_subscribed');
}

export async function getNotificationStatus() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
  // Brave puede bloquear pushManager.getSubscription() aunque haya suscripción activa.
  // Cruzamos con Notification.permission como señal de respaldo.
  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) return 'subscribed';
    // Fallback: si el permiso está concedido y hay un flag local, asumir suscrito
    if (Notification.permission === 'granted' && localStorage.getItem('push_subscribed') === '1') {
      return 'subscribed';
    }
    return 'unsubscribed';
  } catch {
    if (Notification.permission === 'granted' && localStorage.getItem('push_subscribed') === '1') {
      return 'subscribed';
    }
    return 'unsubscribed';
  }
}

export async function initNotifications() {
  if (!isLoggedIn()) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  // No auto-suscribir — el usuario decide desde el botón en inicio
}