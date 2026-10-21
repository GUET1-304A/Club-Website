import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'xingyu-theme'
const CHANGE_EVENT = 'xingyu-theme-change'

export function isDarkMode() {
  return document.documentElement.classList.contains('dark')
}

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#0a0f14' : '#f5f2ed')
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function setDarkMode(dark: boolean) {
  applyTheme(dark)
  try {
    window.localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light')
  } catch {
    // The current page can still switch themes when storage is unavailable.
  }
}

export function toggleDarkMode() {
  setDarkMode(!isDarkMode())
}

function subscribe(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return
    const dark = event.newValue === 'dark' ||
      (event.newValue === null && window.matchMedia('(prefers-color-scheme: dark)').matches)
    applyTheme(dark)
  }
  window.addEventListener(CHANGE_EVENT, callback)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback)
    window.removeEventListener('storage', onStorage)
  }
}

export function useDarkMode() {
  return useSyncExternalStore(subscribe, isDarkMode, () => false)
}
