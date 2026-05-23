import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import campaignRoutes from './routes/campaigns.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

// Middlewares
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Rutas de la API (van antes que el estático para priorizarlas)
app.use('/api/auth', authRoutes)
app.use('/api/campaigns', campaignRoutes)

// Ruta de salud
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Servidor funcionando' })
})

// Redirigir raíz a login
app.get('/', (req, res) => {
  res.redirect('/login.html')
})

app.use(express.static(path.join(__dirname, '../public')))

app.use('/api/', (req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' })
})

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
})