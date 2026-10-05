import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Content-Security-Policy': "default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' http: https: ws: wss:; frame-ancestors 'none'; form-action 'self'",
}

// Vite's React refresh client injects a small inline bootstrap script while
// developing. Production preview remains on the stricter policy above.
const developmentSecurityHeaders = {
  ...securityHeaders,
  'Content-Security-Policy': securityHeaders['Content-Security-Policy'].replace("script-src 'self'", "script-src 'self' 'unsafe-inline'"),
}

// https://vite.dev/config/
export default defineConfig({
  server: { host: '0.0.0.0', headers: developmentSecurityHeaders },
  preview: { headers: securityHeaders },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
})
