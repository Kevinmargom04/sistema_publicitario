// public/js/login.js

const API_BASE = '/api'

function showError(elementId, message) {
  const el = document.getElementById(elementId)
  el.textContent = message
  setTimeout(() => { el.textContent = '' }, 4000)
}

async function handleLogin() {
  const username = document.getElementById('login-username').value.trim()
  const password = document.getElementById('login-password').value
  if (!username || !password) {
    showError('login-error', 'Usuario y contraseña son requeridos')
    return
  }
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión')
    localStorage.setItem('token', data.token)
    // Redirigir al dashboard
    window.location.href = '/dashboard.html'
  } catch (err) {
    showError('login-error', err.message)
  }
}

async function handleRegister() {
  const username = document.getElementById('reg-username').value.trim()
  const name = document.getElementById('reg-name').value.trim()
  const lastName = document.getElementById('reg-lastname').value.trim()
  const age = document.getElementById('reg-age').value
  const password = document.getElementById('reg-password').value
  const confirm = document.getElementById('reg-confirm').value

  if (!username || !name || !password) {
    showError('register-error', 'Usuario, nombre y contraseña son obligatorios')
    return
  }
  if (password !== confirm) {
    showError('register-error', 'Las contraseñas no coinciden')
    return
  }
  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        name,
        lastName: lastName || undefined,
        age: age ? parseInt(age) : undefined,
        password,
        confirmPassword: confirm
      })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Error al registrarse')
    localStorage.setItem('token', data.token)
    window.location.href = '/dashboard.html'
  } catch (err) {
    showError('register-error', err.message)
  }
}

// Cambiar entre pestañas
document.getElementById('tab-login').addEventListener('click', () => {
  document.getElementById('login-form').classList.remove('hidden')
  document.getElementById('register-form').classList.add('hidden')
  document.getElementById('tab-login').classList.add('active')
  document.getElementById('tab-register').classList.remove('active')
})
document.getElementById('tab-register').addEventListener('click', () => {
  document.getElementById('login-form').classList.add('hidden')
  document.getElementById('register-form').classList.remove('hidden')
  document.getElementById('tab-register').classList.add('active')
  document.getElementById('tab-login').classList.remove('active')
})

document.getElementById('login-btn').addEventListener('click', handleLogin)
document.getElementById('register-btn').addEventListener('click', handleRegister)

// Si ya hay token, redirigir directamente al dashboard (opcional)
if (localStorage.getItem('token')) {
  window.location.href = '/dashboard.html'
}