import { describe, expect, it } from 'vitest';
import { db, isCloudStorageEnabled, CoralredStorageError } from './coralred-storage.client-template.js';

/**
 * No VITE_CLOUD_API_BASE/VITE_CLOUD_APP_TOKEN in this test run, so the module loads in its
 * "not deployed yet" state — exactly the WebContainer-preview path from CLOUD-DESIGN.md section 9.
 * That's deliberate: it's the one path this file can exercise for real without a live server.
 */
describe('coralred-storage.client-template (memory fallback, preview mode)', () => {
  it('reports storage as not yet enabled', () => {
    expect(isCloudStorageEnabled).toBe(false);
  });

  it('creates and reads back a document', async () => {
    const created = await db.create('todos', { title: '샘플 할 일' });
    expect(created.id).toBeTruthy();
    expect(created.data).toEqual({ title: '샘플 할 일' });

    const fetched = await db.get('todos', created.id);
    expect(fetched).toEqual(created);
  });

  it('lists documents newest-first', async () => {
    const first = await db.create('notes', { text: 'first' });
    const second = await db.create('notes', { text: 'second' });

    const { items, nextCursor } = await db.list('notes');
    expect(nextCursor).toBeNull();
    expect(items.map((i: { id: string }) => i.id)).toEqual([second.id, first.id]);
  });

  it('updates a document and bumps updatedAt', async () => {
    const created = await db.create('items', { count: 1 });
    const updated = await db.update('items', created.id, { count: 2 });

    expect(updated.data).toEqual({ count: 2 });
    expect(updated.id).toBe(created.id);
  });

  it('throws a Korean 404 error when updating a document that does not exist', async () => {
    await expect(db.update('items', 'missing-id', { count: 1 })).rejects.toMatchObject({
      status: 404,
      message: '찾을 수 없어요.',
    });
  });

  it('throws a Korean 404 error when getting a document that does not exist', async () => {
    await expect(db.get('items', 'missing-id')).rejects.toBeInstanceOf(CoralredStorageError);
  });

  it('removes a document and it is then gone', async () => {
    const created = await db.create('scratch', { a: 1 });
    await db.remove('scratch', created.id);

    await expect(db.get('scratch', created.id)).rejects.toMatchObject({ status: 404 });
  });

  it('remove on a non-existent id does not throw (idempotent delete)', async () => {
    await expect(db.remove('scratch', 'never-existed')).resolves.toBeNull();
  });

  it('keeps different collections independent', async () => {
    await db.create('a', { x: 1 });

    const bList = await db.list('b');
    expect(bList.items).toEqual([]);
  });
});
