import { jwtDecode } from 'jwt-decode'

const TOKEN_KEY = 'token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export function isAuthenticated() {
  const token = getToken()
  if (!token) return false
  try {
    const { exp } = jwtDecode(token)
    return exp * 1000 > Date.now()
  } catch {
    return false
  }
}

export function getUserId() {
  const token = getToken()
  if (!token) return null
  try {
    const decoded = jwtDecode(token)
    return decoded.sub ? Number(decoded.sub) : null
  } catch {
    return null
  }
}

export function useAuth() {
  return {
    token: getToken(),
    isAuthenticated: isAuthenticated(),
    userId: getUserId(),
    setToken,
    removeToken,
  }
}
