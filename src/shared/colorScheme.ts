/**
 * Whether a computed `color-scheme` value means dark. GitHub resolves the user's theme into it
 * (`dark` for dark and dimmed, including an "auto" theme that's currently dark). A page that
 * supports both (`light dark`, like the popup) follows the system preference.
 */
export function isDarkScheme(colorScheme: string, prefersDark: boolean): boolean {
    const schemes = colorScheme.split(/\s+/)
    const dark = schemes.includes('dark')
    return dark && schemes.includes('light') ? prefersDark : dark
}
