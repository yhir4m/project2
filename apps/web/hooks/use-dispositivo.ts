"use client";

/** Id aleatorio del dispositivo (no es un dato personal); se usa para ligar la credencial al teléfono. */
export function idDispositivo(): string {
  const K = "cdv_dispositivo";
  try {
    const v = localStorage.getItem(K);
    if (v) return v;
    const b = crypto.getRandomValues(new Uint8Array(24));
    const nuevo = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(K, nuevo);
    return nuevo;
  } catch {
    return "sin-almacenamiento-" + navigator.userAgent.length.toString().padStart(8, "0");
  }
}
