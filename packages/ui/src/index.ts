/**
 * Tokens de diseño compartibles entre la web (Tailwind/CSS vars) y la futura app Expo (StyleSheet).
 * Alto contraste (WCAG AA ≥ 4.5:1 en texto normal) y tipografía base ≥ 18 px.
 */
export const colores = {
  fondo: "#F7F7F4",
  superficie: "#FFFFFF",
  texto: "#14171A",
  textoSuave: "#4A5260",
  borde: "#D5D9DF",
  primario: "#0B5FFF", // contraste 5.0:1 sobre blanco
  primarioTexto: "#FFFFFF",
  exito: "#0A7A3B",
  exitoFondo: "#E5F5EC",
  error: "#B42318",
  errorFondo: "#FDECEA",
  aviso: "#8A5300",
  avisoFondo: "#FFF4DB",
} as const;

export const coloresOscuro = {
  fondo: "#0E1116",
  superficie: "#171B22",
  texto: "#F2F4F7",
  textoSuave: "#B4BCC8",
  borde: "#2C333D",
  primario: "#5B93FF",
  primarioTexto: "#0E1116",
  exito: "#3DD68C",
  exitoFondo: "#0F2A1C",
  error: "#FF8A80",
  errorFondo: "#3A1512",
  aviso: "#FFC861",
  avisoFondo: "#332508",
} as const;

/** Tamaños en px. `base` ≥ 18 por accesibilidad (adultos mayores). */
export const tipografia = {
  normal: { xs: 15, sm: 16, base: 18, lg: 21, xl: 24, "2xl": 30, "3xl": 38 },
  grande: { xs: 18, sm: 20, base: 22, lg: 26, xl: 30, "2xl": 36, "3xl": 46 },
} as const;

export const espacio = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 } as const;

/** Objetivo táctil mínimo (px). */
export const TOQUE_MINIMO = 48;
export const radio = { sm: 10, md: 14, lg: 20, full: 9999 } as const;
