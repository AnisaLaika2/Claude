// ─────────────────────────────────────────────────────────────
// Cloud sync adapter (interface + local default).
//
// Cibo is offline-first: IndexedDB (lib/db.ts) is always the source
// of truth, so the app is fully functional with no backend. When
// Supabase credentials are present, this adapter mirrors the local
// tables to Postgres and streams realtime changes back for family
// sharing. The schema lives in supabase/migrations/0001_init.sql.
// ─────────────────────────────────────────────────────────────

export interface SyncAdapter {
  readonly enabled: boolean;
  /** Push a locally-changed record to the cloud. */
  upsert(table: string, record: Record<string, unknown>): Promise<void>;
  /** Remove a record from the cloud. */
  remove(table: string, id: string): Promise<void>;
  /** Subscribe to realtime changes from other family members. */
  subscribe(table: string, onChange: (payload: unknown) => void): () => void;
}

// Default no-op adapter used when the app runs purely offline.
class LocalOnlyAdapter implements SyncAdapter {
  readonly enabled = false;
  async upsert() {}
  async remove() {}
  subscribe() {
    return () => {};
  }
}

export const isCloudConfigured = () =>
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Real implementation is wired lazily when @supabase/supabase-js is
// installed and env vars are set. Kept behind a factory so the
// offline build carries no Supabase dependency.
let adapter: SyncAdapter = new LocalOnlyAdapter();

export function getSync(): SyncAdapter {
  return adapter;
}

export function setSync(a: SyncAdapter) {
  adapter = a;
}
