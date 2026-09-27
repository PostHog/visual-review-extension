// Dev-only harness: renders every banner state and the popup with mocked data.
// Build + open: node preview/build.mjs && open preview/out/index.html
import { createRoot } from 'react-dom/client'

import { Banner } from '../src/content/Banner'
import { createShadowRoot } from '../src/content/shadow'
import { Popup } from '../src/popup/Popup'
import popupCss from '../src/popup/popup.css'
import type { AuthState } from '../src/shared/messages'
import type { PrResults, RunApi, RunView } from '../src/shared/types'

const params = new URLSearchParams(location.search)
const popupMode = params.get('popup')

const signedIn: AuthState = {
    signedIn: true,
    host: 'https://us.posthog.com',
    email: 'rafael@posthog.com',
    projectId: 2,
    projects: [
        { id: 2, name: 'PostHog App + Website' },
        { id: 3, name: 'Hedgebox' },
    ],
    trackedRepos: ['PostHog/posthog', 'PostHog/posthog-js', 'PostHog/posthog.com'],
    indexBuiltAt: Date.now() - 12 * 60_000,
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

function run(overrides: Partial<RunApi>): RunApi {
    return {
        id: crypto.randomUUID(),
        repo_id: 'repo',
        status: 'completed',
        run_type: 'storybook',
        commit_sha: '3f9a2c1e8b7d6',
        pr_number: 38012,
        approved: false,
        summary: { total: 1480, changed: 0, new: 0, removed: 0, unchanged: 1480, unresolved: 0 },
        error_message: null,
        created_at: minutesAgo(14),
        completed_at: minutesAgo(9),
        ...overrides,
    }
}

const needsReview: RunView = {
    run: run({ summary: { total: 1480, changed: 3, new: 1, removed: 1, unchanged: 1475, unresolved: 5 } }),
    url: '#',
}

const states: [string, PrResults][] = [
    [
        'Needs review (+ clean playwright run)',
        {
            kind: 'runs',
            runs: [
                { run: run({ run_type: 'playwright', summary: { total: 212, changed: 0, new: 0, removed: 0, unchanged: 212 } }), url: '#' },
                needsReview,
            ],
        },
    ],
    [
        'Approved',
        {
            kind: 'runs',
            runs: [
                {
                    run: run({
                        approved: true,
                        approved_by: { first_name: 'Paul' },
                        summary: { total: 1480, changed: 2, new: 0, removed: 0, unchanged: 1478 },
                    }),
                    url: '#',
                },
            ],
        },
    ],
    ['Clean', { kind: 'runs', runs: [{ run: run({}), url: '#' }] }],
    [
        'Processing',
        { kind: 'runs', runs: [{ run: run({ status: 'processing', completed_at: null, created_at: minutesAgo(1) }), url: '#' }] },
    ],
    [
        'Failed',
        {
            kind: 'runs',
            runs: [{ run: run({ status: 'failed', error_message: 'Baseline file .storybook/snapshots.yml not found on feat/new-nav' }), url: '#' }],
        },
    ],
    ['Error', { kind: 'error', message: 'You do not have access to project 2' }],
]

// These render nothing on GitHub; listed so the preview documents them.
const hiddenStates: [string, PrResults][] = [
    ['Signed out (sign in from the toolbar popup)', { kind: 'signed_out' }],
    ['Repo without visual review (answered from the local repo index, no request)', { kind: 'repo_not_tracked' }],
    ['Tracked repo, no runs for this PR yet (re-checked every minute)', { kind: 'no_runs', repoUrl: '#' }],
]

;(globalThis as any).chrome = {
    runtime: {
        async sendMessage(req: { type: string }) {
            switch (req.type) {
                case 'auth:get':
                    return { ok: true, data: popupMode === 'signedIn' ? signedIn : { signedIn: false, host: 'https://oauth.posthog.com' } }
                case 'pr:results':
                    return { ok: true, data: states[0]![1] }
            }
            return { ok: true, data: undefined }
        },
    },
    storage: {
        local: {
            get: async (key: string) =>
                key === 'repoIndex'
                    ? { repoIndex: { builtAt: signedIn.indexBuiltAt, repos: { 'posthog/posthog': { projectId: 2, repoId: 'repo', fullName: 'PostHog/posthog' } } } }
                    : {},
        },
        onChanged: { addListener() {}, removeListener() {} },
    },
    tabs: { query: async () => [{ url: 'https://github.com/PostHog/posthog/pull/38012' }] },
    permissions: { request: async () => true },
}

function BannerHost({ results }: { results: PrResults }) {
    return (
        <div
            ref={(el) => {
                if (!el || el.shadowRoot) {
                    return
                }
                createShadowRoot(el).render(<Banner results={results} />)
            }}
        />
    )
}

const root = createRoot(document.getElementById('root')!)
if (popupMode) {
    const style = document.createElement('style')
    style.textContent = popupCss
    document.head.append(style)
    document.body.className = 'popup-preview'
    root.render(<Popup />)
} else {
    const theme = params.get('theme') ?? 'light'
    document.body.dataset.theme = theme
    root.render(
        <div className="gh-page">
            {states.map(([name, results]) => (
                <section key={name}>
                    <h2 className="state-name">{name}</h2>
                    <div>
                        <div className="fake-title">
                            Redesign the navigation sidebar <span>#38012</span>
                        </div>
                        <div className="fake-tabs">
                            <span className="on">Conversation</span>
                            <span>Commits</span>
                            <span>Checks</span>
                            <span>Files changed</span>
                        </div>
                    </div>
                    <BannerHost results={results} />
                </section>
            ))}
            <h2 className="state-name">Renders nothing</h2>
            {hiddenStates.map(([name, results]) => (
                <div key={name} className="hidden-state">
                    <span>{name}</span>
                    <BannerHost results={results} />
                </div>
            ))}
        </div>
    )
}
