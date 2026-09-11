import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig(() => {
  const isHmrDisabled = process.env.DISABLE_HMR === 'true';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    define: {
      "import.meta.env.VITE_BRISANET_API_TOKEN": JSON.stringify(
        process.env.VITE_BRISANET_API_TOKEN || process.env.BRISANET_API_TOKEN || "32271|rFgGkhQAB4kk4qTwy2OlabY7Fitg2DqGnMmmadr235a3c944"
      ),
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: !isHmrDisabled,
      // Se HMR estiver desativado, desliga o watcher. 
      // Se estiver ativo (local), liga o watcher mas ignora a pasta de dados persistentes.
      watch: isHmrDisabled 
        ? null 
        : {
            ignored: ["**/data/database.json", "**/data/**"],
          },
    },
  };
});