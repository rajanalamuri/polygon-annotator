import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Avoid duplicate React copies (causes invalid hook call errors).
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Allow access through ALB/DNS hostnames in staging/prod.
    allowedHosts: true,
  },
});
