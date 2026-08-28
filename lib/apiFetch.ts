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
  
  // 1. Baca response sebagai teks biasa dulu agar tidak crash jika kosong
  const text = await r.text();
  
  // 2. Jika teks kosong (misalnya respon DELETE dengan status 204 atau 200 tanpa body)
  if (!text) {
    // Kembalikan fallback standar yang sesuai dengan struktur type-mu
    return { success: r.ok } as unknown as T;
  }
  
  // 3. Coba parse JSON
  try {
    return JSON.parse(text);
  } catch (err) {
    // Jika server sedang error 500 dan mengembalikan HTML, tangkap errornya di sini
    console.error('API Error Response:', text);
    return { 
      success: false, 
      error: `Format respons tidak valid (Status: ${r.status})` 
    } as unknown as T;
  }
}