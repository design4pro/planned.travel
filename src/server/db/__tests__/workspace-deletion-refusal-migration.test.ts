import { expect, it } from 'vitest'
import {
  openReplayDatabase,
  shippedMigrations,
  statementsOf,
} from './migration-files'

it('adds nullable refusal intent without losing ledger data or weakening erasure receipt checks', () => {
  const sqlite = openReplayDatabase()
  try {
    const migrations = shippedMigrations()
    const index = migrations.findIndex(
      (migration) => migration.tag === '0028_yellow_nehzno',
    )
    expect(index).toBeGreaterThan(0)
    for (const migration of migrations.slice(0, index))
      for (const sql of statementsOf(migration.sql)) sqlite.exec(sql)
    const insert = sqlite.prepare(
      "insert into workspace_deletions (id,organization_id,initiator,requested_by,erasure_id,receipt_to,receipt_name,requested_at,updated_at) values (?,?,'owner','owner',null,'private@example.com','Private',1,1)",
    )
    insert.run('before', 'alpha')
    const before = sqlite
      .prepare('select * from workspace_deletions where id = ?')
      .get('before')
    const indexes = sqlite
      .prepare(
        "select name, sql from sqlite_master where type = 'index' and tbl_name = 'workspace_deletions' order by name",
      )
      .all()
    expect(migrations[index].sql).toMatch(
      /^ALTER TABLE `workspace_deletions` ADD `refusal_reason` text;/,
    )
    for (const sql of statementsOf(migrations[index].sql)) sqlite.exec(sql)
    expect(
      sqlite
        .prepare('select * from workspace_deletions where id = ?')
        .get('before'),
    ).toEqual({ ...before, refusal_reason: null })
    expect(
      sqlite
        .prepare(
          "select name, sql from sqlite_master where type = 'index' and tbl_name = 'workspace_deletions' order by name",
        )
        .all(),
    ).toEqual(indexes)
    insert.run('old-worker', 'beta')
    expect(
      sqlite
        .prepare('select refusal_reason from workspace_deletions where id = ?')
        .get('old-worker'),
    ).toMatchObject({ refusal_reason: null })
    expect(() =>
      sqlite.exec(
        "insert into workspace_deletions (id,organization_id,initiator,erasure_id,receipt_to,requested_at,updated_at) values ('bad','erasure','erasure','erase','private@example.com',1,1)",
      ),
    ).toThrow()
    expect(() => insert.run('duplicate', 'alpha')).toThrow()
    expect(sqlite.prepare('pragma foreign_key_check').all()).toEqual([])
  } finally {
    sqlite.close()
  }
})
