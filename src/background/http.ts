export interface ErrorDetail {
    /** Machine-readable OAuth error code (e.g. `invalid_client`), when the body has one. */
    code?: string
    message: string
}

/** Pull what went wrong out of a failed PostHog or OAuth response. */
export async function errorDetail(response: Response): Promise<ErrorDetail> {
    const fallback = response.statusText || `HTTP ${response.status}`
    try {
        const body = (await response.json()) as { error?: string; error_description?: string; detail?: string }
        return { code: body.error, message: body.error_description || body.detail || body.error || fallback }
    } catch {
        return { message: fallback }
    }
}
