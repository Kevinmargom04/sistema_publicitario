import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import prisma from '../utils/prisma.js'

const JWT_SECRET = process.env.JWT_SECRET || 'mi_secreto_super_seguro'

export const register = async (req, res) => {
  try {
    const { username, name, lastName, age, password, confirmPassword } = req.body

    if (!username || !name || !password) {
      return res.status(400).json({ error: 'Usuario, nombre y contraseña son requeridos' })
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Las contraseñas no coinciden' })
    }

    const existingUser = await prisma.user.findUnique({ where: { username } })
    if (existingUser) {
      return res.status(400).json({ error: 'El nombre de usuario ya está registrado' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    // Crear usuario
    const user = await prisma.user.create({
      data: {
        username,
        name,
        lastName: lastName || null,
        age: age ? parseInt(age) : null,
        password: hashedPassword,
      },
    })

    const campaign = await prisma.campaign.create({
      data: {
        name: 'Mi primera campaña',
        userId: user.id,
      },
    })

    const catalogs = await prisma.mediumCatalog.findMany()
    if (catalogs.length === 0) {
      console.warn('⚠️ Catálogo de medios vacío. Ejecuta el seed.')
    } else {
      await prisma.campaignMedium.createMany({
        data: catalogs.map((cat, idx) => ({
          campaignId: campaign.id,
          mediumCatalogId: cat.id,
          cpr: cat.defaultCPR,
          am: cat.defaultAM,
          v: cat.defaultV,
          investment: 0,
          orderIndex: idx,
        })),
      })
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' })

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        lastName: user.lastName,
        age: user.age,
      },
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error en el servidor' })
  }
}

export const login = async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' })
    }

    const user = await prisma.user.findUnique({ where: { username } })
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' })

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        lastName: user.lastName,
        age: user.age,
      },
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error en el servidor' })
  }
}