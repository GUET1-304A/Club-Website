import { useEffect, useSyncExternalStore } from 'react'
import { applyDocumentMetadata, resolveMetadata, type DetailMetadata, type MetadataOverride } from '../lib/metadata'

let override: MetadataOverride | null = null
const listeners = new Set<() => void>()
const publish = () => listeners.forEach(listener => listener())
const snapshot = () => override
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

export function useRouteMetadata(path: string, config: { siteName: string; siteDescription: string }) {
  const detail = useSyncExternalStore(subscribe, snapshot, snapshot)
  useEffect(() => {
    applyDocumentMetadata(resolveMetadata(path, config, detail, import.meta.env.VITE_PUBLIC_SITE_URL))
  }, [path, config, detail])
}

export function useDetailMetadata(path: string, { title, description, image, type, noIndex }: DetailMetadata) {
  useEffect(() => {
    const owner: MetadataOverride = { path, title, description, image, type, noIndex }
    override = owner
    publish()
    return () => { if (override === owner) { override = null; publish() } }
  }, [path, title, description, image, type, noIndex])
}
