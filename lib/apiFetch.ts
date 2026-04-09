/**
 * Wrapper fetch yang selalu menyertakan credentials (cookie)
 * Gunakan ini untuk semua panggilan API internal
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...options.headers,
    },
  });
}

export async function apiJson<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const r = await apiFetch(url, options);
  return r.json();
}
