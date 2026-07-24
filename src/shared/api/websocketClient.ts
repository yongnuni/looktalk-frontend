export function createWebSocket(path: string) {
  const baseUrl = import.meta.env.VITE_WS_BASE_URL ?? 'ws://localhost:8080';
  return new WebSocket(`${baseUrl}${path}`);
}