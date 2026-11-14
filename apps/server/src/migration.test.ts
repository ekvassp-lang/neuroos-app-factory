import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { newDb } from 'pg-mem';

describe('SQL migration 0001_init.sql (pg-mem emulation)', () => {
  it('applies cleanly and enforces schema constraints', async () => {
    const sql = await readFile(
      path.join(process.cwd(), '../../migrations/0001_init.sql'),
      'utf8',
    );
    const db = newDb();
    db.public.none(sql);

    db.public.none(
      `INSERT INTO users (id, email, role) VALUES
        ('11111111-1111-1111-1111-111111111111', 'owner@nf.local', 'owner'),
        ('22222222-2222-2222-2222-222222222222', 'eng@nf.local', 'engineer')`,
    );
    db.public.none(
      `INSERT INTO projects (id, name, slug, owner_id)
       VALUES ('33333333-3333-3333-3333-333333333333', 'Demo', 'demo',
               '11111111-1111-1111-1111-111111111111')`,
    );
    db.public.none(
      `INSERT INTO gates (id, project_id, code, status)
       VALUES ('44444444-4444-4444-4444-444444444444',
               '33333333-3333-3333-3333-333333333333', 'G0', 'approved')`,
    );

    const projects = db.public.many('SELECT name, slug, status FROM projects');
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({ slug: 'demo', status: 'IDEA' });

    const gates = db.public.many('SELECT code, status FROM gates');
    expect(gates).toEqual([{ code: 'G0', status: 'approved' }]);
  });

  it('rejects invalid role and invalid gate code (CHECK constraints)', async () => {
    const sql = await readFile(
      path.join(process.cwd(), '../../migrations/0001_init.sql'),
      'utf8',
    );
    const db = newDb();
    db.public.none(sql);

    expect(() =>
      db.public.none(
        `INSERT INTO users (id, email, role)
         VALUES ('55555555-5555-5555-5555-555555555555', 'x@nf.local', 'admin')`,
      ),
    ).toThrow();
    expect(() =>
      db.public.none(
        `INSERT INTO gates (id, project_id, code)
         VALUES ('66666666-6666-6666-6666-666666666666',
                 '77777777-7777-7777-7777-777777777777', 'G9')`,
      ),
    ).toThrow();
  });
});
