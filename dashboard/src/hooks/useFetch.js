import { useEffect, useState, useCallback } from 'react'

export function useFetch(url, interval = null) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { setData(d); setError(null) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [url])

  useEffect(() => {
    load()
    if (!interval) return
    const id = setInterval(load, interval)
    return () => clearInterval(id)
  }, [load, interval])

  return { data, error, loading, reload: load }
}
