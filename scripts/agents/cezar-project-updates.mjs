import { execFile } from 'node:child_process'
import { readFileSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const interval = 6 * 60 * 60 * 1000
const retry = 5 * 60 * 1000
const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

export class ProjectSkillUpdater {
  constructor(options = {}) {
    this.baseUrl = options.projectUpdateBaseUrl ?? ''
    this.registry =
      options.projectUpdateRegistry ??
      join(
        homedir(),
        '.local/lib/codex-project/skills-auto-update-projects.json',
      )
    this.run =
      options.projectUpdateRun ??
      ((root) =>
        exec(
          'python3',
          [
            fileURLToPath(new URL('./skills-auto-update.py', import.meta.url)),
            'update',
            '--repo',
            root,
            '--cezar-url',
            this.baseUrl,
          ],
          { timeout: 300_000, maxBuffer: 1024 * 1024 },
        ))
    this.now = options.now ?? Date.now
    this.pending = new Map()
    this.next = new Map()
    this.results = new Map()
    this.generations = new Map()
    this.timer = setInterval(() => {
      for (const [root, due] of this.next) {
        if (due <= this.now()) void this.check(root).catch(() => {})
      }
    }, 60_000)
    this.timer.unref()
  }

  enabled(root) {
    try {
      const canonical = realpathSync(root)
      const records = readJson(this.registry)?.projects ?? []
      const config = readJson(join(canonical, '.agents/skills-updates.json'))
      return (
        records.some((record) => record.root === canonical) &&
        config?.enabled === true &&
        Object.keys(config).sort().join(',') ===
          'branch,enabled,intervalHours,source' &&
        config.source === 'open-mercato/skills' &&
        config.branch === 'main' &&
        config.intervalHours === 6
      )
    } catch {
      return false
    }
  }

  snapshot(root) {
    const enabled = this.enabled(root)
    const raw =
      this.results.get(root) ??
      readJson(join(root, '.ai/tmp/skills-auto-update/status.json')) ??
      {}
    const busy = this.pending.has(root)
    const status = !enabled
      ? 'unavailable'
      : busy
        ? 'updating'
        : raw.status === 'error'
          ? 'error'
          : raw.status === 'current'
            ? 'current'
            : 'idle'
    return {
      status,
      managedByProject: true,
      autoUpdateEnabled: enabled,
      inherited: false,
      available: false,
      checkedAt: raw.checkedAt ?? null,
      updatedAt: raw.updatedAt ?? null,
      needsUpgradeNotes: false,
      nextCheckAt:
        enabled && this.next.has(root)
          ? new Date(this.next.get(root)).toISOString()
          : null,
      installedSha: raw.installedSha,
      latestSha: raw.latestSha,
      managedMessage: !enabled
        ? 'Automatic skill updates are not enabled for this checkout.'
        : busy
          ? 'Checking and preparing project-only Open Mercato skill updates.'
          : (raw.message ??
            'Automatic updates run at startup and every six hours while Cezar is running.'),
      scopes: [
        {
          scope: 'project',
          status,
          available: false,
          skills: [],
          checkedAt: raw.checkedAt ?? null,
          updatedAt: raw.updatedAt ?? null,
        },
      ],
    }
  }

  check(root, force = false) {
    if (!this.enabled(root)) return Promise.resolve(this.snapshot(root))
    if (this.pending.has(root)) return this.pending.get(root)
    if (!force && (this.next.get(root) ?? 0) > this.now())
      return Promise.resolve(this.snapshot(root))
    const generation = this.generations.get(root) ?? 0
    const task = Promise.resolve()
      .then(() => this.run(root))
      .then(({ stdout }) => {
        if ((this.generations.get(root) ?? 0) !== generation) return
        const result = JSON.parse(stdout)
        this.results.set(root, result)
        this.next.set(
          root,
          this.now() + (result.status === 'current' ? interval : retry),
        )
      })
      .catch(() => {
        if ((this.generations.get(root) ?? 0) !== generation) return
        this.results.set(root, {
          status: 'error',
          message: 'The project updater did not finish. Retry is scheduled.',
        })
        this.next.set(root, this.now() + retry)
      })
      .then(() => {
        this.pending.delete(root)
        return this.snapshot(root)
      })
    this.pending.set(root, task)
    return task
  }

  update(root) {
    return this.check(root, true)
  }
  evict(root) {
    this.generations.set(root, (this.generations.get(root) ?? 0) + 1)
    this.next.delete(root)
    this.results.delete(root)
  }
  stop() {
    clearInterval(this.timer)
  }
}
