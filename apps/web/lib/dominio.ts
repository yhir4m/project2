/**
 * Dominio público fijo de producción. Los QR impresos apuntan aquí, así que no debe cambiar
 * con cada deploy. Se puede sobrescribir con APP_URL (si no es localhost).
 */
export const DOMINIO_PRODUCCION = "https://project2-amber-omega.vercel.app";

export function urlCanonica(): string {
  const app = process.env.APP_URL;
  if (app && !/\/\/(localhost|127\.|0\.0\.0\.0)/i.test(app)) return app.replace(/\/$/, "");
  return DOMINIO_PRODUCCION;
}
