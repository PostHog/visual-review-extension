// Firefox exposes the Promise-based `browser` namespace, Chrome only `chrome`. A page element with
// id="browser" also shows up on window in a content script, so only a namespace with a runtime ID counts.
export function extensionBrowser(): typeof chrome {
    const namespace = (globalThis as typeof globalThis & { browser?: typeof chrome }).browser
    return namespace?.runtime?.id ? namespace : chrome
}
