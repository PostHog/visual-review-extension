import { beforeEach, describe, expect, it, vi } from 'vitest'

const store: Record<string, unknown> = {}
vi.stubGlobal('chrome', {
    storage: {
        local: {
            get: async (key: string) => ({ [key]: store[key] }),
            set: async (items: Record<string, unknown>) => Object.assign(store, items),
            remove: async (key: string) => delete store[key],
        },
    },
})

const index = () => store.repoIndex as import('../shared/repoIndex').RepoIndex

const reposByProject: Record<number, { id: string; repo_full_name: string }[] | 'forbidden'> = {
    1: [{ id: 'a', repo_full_name: 'PostHog/posthog' }],
    2: [
        { id: 'b', repo_full_name: 'PostHog/posthog' },
        { id: 'c', repo_full_name: 'PostHog/posthog-js' },
    ],
    3: 'forbidden',
}

vi.mock('./session', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./session')>()),
    api: async (path: string) => {
        const projectId = Number(/projects\/(\d+)\//.exec(path)![1])
        const repos = reposByProject[projectId]
        if (repos === 'forbidden') {
            const { ApiError } = await importOriginal<typeof import('./session')>()
            throw new ApiError('forbidden', 403)
        }
        return { results: repos }
    },
}))

const { refreshRepoIndex } = await import('./repoIndex')

const projects = [1, 2, 3].map((id) => ({ id, name: `P${id}` }))

describe('refreshRepoIndex', () => {
    beforeEach(() => {
        for (const key of Object.keys(store)) {
            delete store[key]
        }
    })

    it('indexes repos across projects, keyed case-insensitively, skipping inaccessible projects', async () => {
        await refreshRepoIndex(projects, undefined)
        expect(Object.keys(index().repos).sort()).toEqual(['posthog/posthog', 'posthog/posthog-js'])
    })

    it('lets the preferred project win for a repo set up in several', async () => {
        await refreshRepoIndex(projects, 2)
        expect(index().repos['posthog/posthog']).toMatchObject({ projectId: 2, repoId: 'b' })
        await refreshRepoIndex(projects, 1)
        expect(index().repos['posthog/posthog']).toMatchObject({ projectId: 1, repoId: 'a' })
    })
})
