// Dev-only harness: renders every merge box tile state and the popup with mocked data.
// Build + open: node preview/build.mjs && open preview/out/index.html
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'

import mergeboxCss from '../src/content/mergebox.css'
import { createShadowRoot } from '../src/content/shadow'
import { RunsPanel, StatusTile } from '../src/content/StatusTile'
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
                    return { ok: true, data: popupMode === 'signedIn' ? signedIn : {
                        signedIn: false,
                        host: 'https://oauth.posthog.com',
                        signInError: popupMode === 'firefoxNeedsClient'
                            ? 'Firefox needs a registered OAuth client. Register a public client with the callback https://5ed7694585fc080f01fd256960c1126b795185f5.extensions.allizom.org/, then build with POSTHOG_OAUTH_CLIENT_ID set to its client ID. See "Firefox developer setup" in the README.'
                            : undefined,
                    } }
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

/** A shadow root with the tile's styles, rendering `children`, like the extension does on GitHub. */
function Shadow({
    as: Tag = 'div',
    id,
    plain,
    children,
}: {
    as?: 'div' | 'section'
    id?: string
    /** Not a tile: drop the tile's host box (divider, corner, clipping). */
    plain?: boolean
    children: ReactNode
}) {
    return (
        <Tag
            id={id}
            style={plain ? { border: 0, overflow: 'visible' } : undefined}
            ref={(el: HTMLElement | null) => {
                if (el && !el.shadowRoot) {
                    createShadowRoot(el).render(children)
                }
            }}
        />
    )
}

/** One of GitHub's own status tiles, as far as looks go. */
function GhTile({ label, summary, segments }: { label: string; summary?: string; segments?: [string, number][] }) {
    return (
        <section className="gh-tile">
            <div className="gh-tile-label">
                <strong>{label}</strong>
                {summary && <span className="gh-tile-summary">{summary}</span>}
            </div>
            {segments ? (
                <div className="gh-bar">
                    {segments.map(([tone, width], i) => (
                        <span key={i} className={`gh-segment gh-${tone}`} style={{ width: `${width}%` }} />
                    ))}
                </div>
            ) : (
                <div className="gh-bar-unavailable" />
            )}
        </section>
    )
}

/** GitHub's merge box with our tile last in its row of status tiles, and the tile's panel below. */
function FakeMergeBox({ results, narrow }: { results: PrResults; narrow?: boolean }) {
    return (
        <div className={narrow ? 'gh-merge narrow' : 'gh-merge'}>
            <div className="gh-mergebox">
                <div className="gh-recommended">
                    <strong>Approval required</strong>
                    <span>Request another approving review before this can merge.</span>
                </div>
                <div className="gh-grid">
                    <section className="gh-tiles">
                        <GhTile label="Checks" summary="4 pending" segments={[['success', 46], ['neutral', 52], ['attention', 2]]} />
                        <GhTile label="Comments" />
                        <GhTile label="Approvals" summary="1 still required" segments={[['attention', 100]]} />
                        <Shadow as="section" id="posthog-visual-review">
                            <StatusTile results={results} />
                        </Shadow>
                    </section>
                </div>
            </div>
            {/* Opens as a popover under the tile on GitHub; shown in place here. */}
            <Shadow plain>
                <div className="panel" style={{ position: 'static', margin: '8px 0 0 auto' }}>
                    <RunsPanel results={results} />
                </div>
            </Shadow>
        </div>
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
    // GitHub resolves its theme into the page's color-scheme; the logomark reads it from there.
    document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light'
    const style = document.createElement('style')
    style.textContent = mergeboxCss
    document.head.append(style)
    root.render(
        <div className="gh-page">
            {states.map(([name, results]) => (
                <section key={name}>
                    <h2 className="state-name">{name}</h2>
                    <FakeMergeBox results={results} />
                </section>
            ))}
            <h2 className="state-name">Narrow merge box (under 768px): tiles stack</h2>
            <FakeMergeBox results={states[0]![1]} narrow />
            <h2 className="state-name">Renders nothing</h2>
            {hiddenStates.map(([name]) => (
                <div key={name} className="hidden-state">
                    <span>{name}</span>
                </div>
            ))}
        </div>
    )
}
