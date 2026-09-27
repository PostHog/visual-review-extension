/** A typed chrome.storage.local key. Setting null removes it. */
export interface StorageItem<T> {
    key: string
    get(): Promise<T | null>
    set(value: T | null): Promise<void>
}

export function storageItem<T>(key: string): StorageItem<T> {
    return {
        key,
        async get() {
            return ((await chrome.storage.local.get(key))[key] as T | undefined) ?? null
        },
        async set(value) {
            if (value === null) {
                await chrome.storage.local.remove(key)
            } else {
                await chrome.storage.local.set({ [key]: value })
            }
        },
    }
}

/** Call `listener` whenever one of `items` changes in chrome.storage.local. Returns the unsubscribe. */
export function onStorageChange(items: StorageItem<unknown>[], listener: () => void): () => void {
    const keys = new Set(items.map((i) => i.key))
    const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
        if (area === 'local' && Object.keys(changes).some((k) => keys.has(k))) {
            listener()
        }
    }
    chrome.storage.onChanged.addListener(handler)
    return () => chrome.storage.onChanged.removeListener(handler)
}
