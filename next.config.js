/** @type {import('next').NextConfig} */
const fs = require('fs')
const path = require('path')

// Manually parse .env.local to ensure all vars are loaded
function loadEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    content.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return
      const idx = trimmed.indexOf('=')
      if (idx === -1) return
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim()
      if (key && !process.env[key]) process.env[key] = val
    })
  } catch {}
}

loadEnvFile(path.join(__dirname, '.env.local'))
loadEnvFile(path.join(__dirname, '.env'))

const nextConfig = {}
module.exports = nextConfig
