import { vlyPlugin } from "@vly-ai/integrations";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), vlyPlugin(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Force a single copy of React across all packages (including vlyPlugin).
    // Without this, @vly-ai/integrations can resolve its own React copy, which
    // triggers "Invalid hook call" errors at runtime.
    dedupe: ["react", "react/jsx-runtime", "react-dom", "react-dom/client"],
  },
  build: {
    // This sandbox shares a ~2 GB ceiling between the dev server, `convex dev`
    // and the publish build. Keep the rollup worker count low and don't hold
    // every generated asset in memory twice for gzip reporting.
    sourcemap: false,
    reportCompressedSize: false,
    rollupOptions: {
      // Default (20) transforms too many modules at once while esbuild is
      // resident and OOM-kills the build service.
      maxParallelFileOps: 2,
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks(id) {
          // Keep the big optional stacks out of the main bundle so the V8
          // heap during minification stays bounded.
          if (id.includes('node_modules/mathlive')) return 'mathlive';
          if (id.includes('node_modules/mathjs')) return 'mathjs';
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/three/examples')) return 'three-examples';
          if (id.includes('node_modules/recharts')) return 'charts';
          if (id.includes('node_modules/framer-motion')) return 'framer-motion';
          if (id.includes('node_modules/@radix-ui')) return 'radix-ui';
          if (id.includes('node_modules/zod')) return 'forms-validation';
          if (
            id.includes('node_modules/react-hook-form') ||
            id.includes('node_modules/@hookform/resolvers')
          ) return 'forms';
          if (id.includes('node_modules/embla-carousel-react')) return 'embla';
          if (id.includes('node_modules/react-resizable-panels')) return 'panels';
          if (id.includes('node_modules/function-plot')) return 'function-plot';
          if (id.includes('node_modules/d3-')) return 'd3';
          if (id.includes('node_modules/gsap')) return 'gsap';
          if (id.includes('node_modules/lenis')) return 'lenis';
          if (id.includes('node_modules/@visx')) return 'visx';
          if (id.includes('node_modules/date-fns')) return 'date-fns';
          if (id.includes('node_modules/sonner')) return 'sonner';
          if (id.includes('node_modules/unpdf')) return 'unpdf';
          if (id.includes('node_modules/@tabler/icons-react')) return 'tabler';
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    target: 'esnext',
    minify: 'esbuild',
  },
  optimizeDeps: {
    entries: ['index.html'],
    include: [
      'react',
      'react/jsx-runtime',
      'react-dom',
      'react-dom/client',
      'react-router',
      // Keep framer-motion in the optimizer cache; the fan renders it many
      // times across MathLab and the dashboard and that repeat bundling is
      // more expensive than the cache cost in this sandbox.
      'framer-motion',
    ],
  },
  server: {
    host: true,
    port: 5173,
    hmr: {
      overlay: false,
    },
  },
});
