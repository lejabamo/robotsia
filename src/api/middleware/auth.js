/**
 * ============================================
 * Middleware de Autenticación JWT
 * ============================================
 */
const jwt = require('jsonwebtoken');
const config = require('../../config/env');

/**
 * Verifica el token JWT en el header Authorization.
 */
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticación requerido' });
  }

  const token = header.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado, inicie sesión nuevamente' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
}

/**
 * Genera un token JWT para un usuario autenticado.
 */
function generarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, email: usuario.email, rol: usuario.rol, nombre: usuario.nombre },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

/**
 * Middleware de control de roles.
 * @param  {...string} rolesPermitidos - Roles que tienen acceso
 */
function requiereRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (!rolesPermitidos.includes(req.user.rol)) {
      return res.status(403).json({
        error: `Acceso denegado. Se requiere rol: ${rolesPermitidos.join(' o ')}`
      });
    }
    next();
  };
}

module.exports = { auth, generarToken, requiereRol };
