import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import AppLoading from '../components/AppLoading/AppLoading.jsx'

const AppLoadingContext = createContext(null)

/** Duração mínima do splash ao abrir a app (ms). */
const BOOT_SPLASH_MIN_MS = 520

/**
 * Carregamento global full-screen: splash inicial + qualquer fluxo que chame begin/end em pares.
 *
 * @example
 * const { beginLoading, endLoading, runWithLoading } = useAppLoading()
 * await runWithLoading(() => fetch(...))
 */
export function AppLoadingProvider({ children }) {
  const [depth, setDepth] = useState(1)

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDepth((d) => Math.max(0, d - 1))
    }, BOOT_SPLASH_MIN_MS)
    return () => window.clearTimeout(id)
  }, [])

  const beginLoading = useCallback(() => {
    setDepth((d) => d + 1)
  }, [])

  const endLoading = useCallback(() => {
    setDepth((d) => Math.max(0, d - 1))
  }, [])

  const runWithLoading = useCallback(
    async (task) => {
      beginLoading()
      try {
        return await task()
      } finally {
        endLoading()
      }
    },
    [beginLoading, endLoading],
  )

  const value = useMemo(
    () => ({
      beginLoading,
      endLoading,
      runWithLoading,
    }),
    [beginLoading, endLoading, runWithLoading],
  )

  return (
    <AppLoadingContext.Provider value={value}>
      {children}
      {depth > 0 ? <AppLoading /> : null}
    </AppLoadingContext.Provider>
  )
}

export function useAppLoading() {
  const ctx = useContext(AppLoadingContext)
  if (!ctx) {
    throw new Error('useAppLoading deve ser usado dentro de AppLoadingProvider.')
  }
  return ctx
}
