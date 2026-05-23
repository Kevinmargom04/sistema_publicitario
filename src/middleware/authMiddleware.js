import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'mi_secreto_super_seguro'

export const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. No hay token.' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.userId = decoded.userId
    next()
  } catch (error) {
    res.status(401).json({ error: 'Token inválido o expirado.' })
  }
}