/**
 * Tokens de diseño compartibles entre la web (Tailwind/CSS vars) y la futura app Expo (StyleSheet).
 * Alto contraste (WCAG AA ≥ 4.5:1 en texto normal) y tipografía base ≥ 18 px.
 */
/** Paleta "hirashi" (dorado, crema, pizarra) con ajustes de contraste WCAG AA. */
export const colores = {
  fondo: "#F7F3EB",
  superficie: "#FFFFFF",
  superficie2: "#F1EDE4",
  texto: "#1F1F1F",
  textoSuave: "#5C5C5C",
  borde: "#E3DED1",
  primario: "#C5A358", // fondo de botones; texto encima = primarioTexto (6.9:1)
  primarioTexto: "#1F1F1F",
  acento: "#766134", // dorado para texto/íconos sobre crema (5.4:1)
  accion: "#00D084", // pagar/confirmar; texto encima = accionTexto (7.7:1)
  accionTexto: "#1A252B",
  pizarra: "#1A252B",
  exito: "#3A6B4F",
  exitoFondo: "#E6EFE9",
  error: "#AF3030",
  errorFondo: "#F7E4E1",
  aviso: "#8A5300",
  avisoFondo: "#FBEFD9",
} as const;

export const coloresOscuro = {
  fondo: "#121A1E",
  superficie: "#1A252B",
  superficie2: "#223037",
  texto: "#F7F3EB",
  textoSuave: "#C4BCAD",
  borde: "#2E3A40",
  primario: "#C5A358",
  primarioTexto: "#1A252B",
  acento: "#D9BD7C",
  accion: "#00D084",
  accionTexto: "#0E1A14",
  pizarra: "#1A252B",
  exito: "#7CC49A",
  exitoFondo: "#15291E",
  error: "#EC8A7F",
  errorFondo: "#3A1714",
  aviso: "#F0C46A",
  avisoFondo: "#33270E",
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
