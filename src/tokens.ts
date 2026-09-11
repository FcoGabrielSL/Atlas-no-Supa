/**
 * Brisanet Design Tokens
 * 
 * Primária (Protagonista): Laranja Vibrante (#FF5022)
 * Secundária / Apoio: Azul Realce (#0055FF)
 * Neutras / Texto: Grafite Escuro (#1E1E1E)
 */

export const colors = {
  // Primária (Protagonista): Laranja Vibrante (#FF5022)
  primary: {
    50: "#FFF5F2",
    100: "#FFE8E2",
    200: "#FFD1C5",
    300: "#FFA792",
    400: "#FF7855",
    500: "#FF5022", // Cor Base Oficial
    600: "#E63D10", // Hover
    700: "#C22E06", // Active / Pressed
    800: "#992607",
    900: "#7A220A",
    950: "#420E02",
  },

  // Alias brand para primary
  brand: {
    50: "#FFF5F2",
    100: "#FFE8E2",
    200: "#FFD1C5",
    300: "#FFA792",
    400: "#FF7855",
    500: "#FF5022",
    600: "#E63D10",
    700: "#C22E06",
    800: "#992607",
    900: "#7A220A",
    950: "#420E02",
  },
  
  // Secundária / Apoio: Azul Realce (#0055FF)
  secondary: {
    50: "#EEF4FF",
    100: "#DCE7FE",
    200: "#BFD5FE",
    300: "#93BAFD",
    400: "#6095FA",
    500: "#0055FF", // Cor Base Oficial
    600: "#0045D6", // Hover
    700: "#0037AD", // Active / Pressed
    800: "#002D8C",
    900: "#002773",
    950: "#00174A",
  },

  // Alias accent para secondary
  accent: {
    50: "#EEF4FF",
    100: "#DCE7FE",
    200: "#BFD5FE",
    300: "#93BAFD",
    400: "#6095FA",
    500: "#0055FF",
    600: "#0045D6",
    700: "#0037AD",
    800: "#002D8C",
    900: "#002773",
    950: "#00174A",
  },

  // Neutras: Grafite Escuro (#1E1E1E) e Superfícies
  graphite: {
    50: "#F9FAFB", // Fundo Cards Suave
    100: "#F3F4F6", // Fundo Inputs / Hover
    200: "#E5E7EB", // Bordas Neutras
    300: "#D1D5DB", // Bordas Interativas
    400: "#9CA3AF", // Textos Desabilitados
    500: "#6B7280", // Textos Secundários / Muted
    600: "#4B5563", // Textos Apoio
    700: "#374151", // Textos Intermediários
    800: "#262626", // Textos Escuros
    900: "#1E1E1E", // Cor Oficial para Textos / Títulos
    950: "#121212", // Background Escuro Puro
  },

  // Mapeamento semântico
  text: {
    primary: "#1E1E1E",
    secondary: "#4B5563",
    muted: "#6B7280",
    disabled: "#9CA3AF",
    inverse: "#FFFFFF",
    brand: "#FF5022",
    accent: "#0055FF",
  },

  background: {
    page: "#F8FAFC",
    card: "#FFFFFF",
    cardSubtle: "#F9FAFB",
    primary: "#FF5022",
    secondary: "#0055FF",
  }
} as const;

export type BrandColors = typeof colors;
