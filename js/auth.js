import { api } from "./api.js";

export async function login(usuario, contrasena) {
  const data = await api.post("/auth/login", { usuario, contrasena });
  const expiresAt = Date.now() + (data.expiraEn || 3600) * 1000;
  localStorage.setItem("jwt_token", data.token);
  localStorage.setItem("jwt_expires", String(expiresAt));
  localStorage.setItem("current_user", usuario);
  return data;
}

export function logout() {
  localStorage.removeItem("jwt_token");
  localStorage.removeItem("jwt_expires");
  localStorage.removeItem("current_user");
  window.location.hash = "#/login";
}

export function isLoggedIn() {
  const token = localStorage.getItem("jwt_token");
  const expires = Number(localStorage.getItem("jwt_expires") || 0);
  return !!token && Date.now() < expires;
}

export function isOfflineButAuthenticated() {
  // Retorna true si estamos offline PERO tenemos un token válido
  return !navigator.onLine && isLoggedIn();
}

export function getCurrentUser() {
  return localStorage.getItem("current_user") || "";
}

export function requireAuth() {
  if (!isLoggedIn()) {
    window.location.hash = "#/login";
    return false;
  }
  return true;
}
