import { describe, expect, it } from 'vitest';
import { getFineTunedPrompt, CACHE_BREAKPOINT_MARKER } from './new-prompt';

function staticPrefixOf(prompt: string): string {
  return prompt.split(CACHE_BREAKPOINT_MARKER)[0];
}

describe('getFineTunedPrompt — storage track selection (overnight6 task 4)', () => {
  it('defaults to STORAGE_MODE "cloud" when no supabase state is given', () => {
    const prompt = getFineTunedPrompt();
    expect(prompt).toContain('STORAGE_MODE for this request: "cloud"');
  });

  it('defaults to STORAGE_MODE "cloud" when supabase is present but not connected', () => {
    const prompt = getFineTunedPrompt('/home/project', { isConnected: false, hasSelectedProject: false });
    expect(prompt).toContain('STORAGE_MODE for this request: "cloud"');
  });

  it('switches to STORAGE_MODE "supabase" once the user has connected their own project', () => {
    const prompt = getFineTunedPrompt('/home/project', {
      isConnected: true,
      hasSelectedProject: true,
      credentials: { supabaseUrl: 'https://x.supabase.co', anonKey: 'anon-key' },
    });
    expect(prompt).toContain('STORAGE_MODE for this request: "supabase"');
  });

  it('reminds the AI about project selection only when connected but no project is chosen', () => {
    const noProject = getFineTunedPrompt('/home/project', { isConnected: true, hasSelectedProject: false });
    expect(noProject).toContain('no project selected');

    const withProject = getFineTunedPrompt('/home/project', {
      isConnected: true,
      hasSelectedProject: true,
      credentials: { supabaseUrl: 'https://x.supabase.co', anonKey: 'anon-key' },
    });
    expect(withProject).not.toContain('no project selected');

    const cloudMode = getFineTunedPrompt();
    expect(cloudMode).not.toContain('no project selected');
  });

  it('injects the Supabase .env values only in supabase mode, never in cloud mode', () => {
    const cloudMode = getFineTunedPrompt();
    expect(cloudMode).not.toContain('VITE_SUPABASE_URL=');

    const supabaseMode = getFineTunedPrompt('/home/project', {
      isConnected: true,
      hasSelectedProject: true,
      credentials: { supabaseUrl: 'https://x.supabase.co', anonKey: 'anon-key' },
    });
    expect(supabaseMode).toContain('VITE_SUPABASE_URL=https://x.supabase.co');
    expect(supabaseMode).toContain('VITE_SUPABASE_ANON_KEY=anon-key');
  });

  it('embeds the actual coralred-storage SDK source verbatim (db.create is a real export)', () => {
    const prompt = getFineTunedPrompt();
    expect(prompt).toContain('export const db = {');
    expect(prompt).toContain('isCloudStorageEnabled');
  });

  it('tells the AI to skip login/signup screens in Track A', () => {
    const prompt = getFineTunedPrompt();
    expect(prompt).toContain('no accounts, no login screens');
  });

  it('never emits the old "not connected to Supabase, remind user" nag now that Cloud is the default', () => {
    const cloudMode = getFineTunedPrompt();
    expect(cloudMode).not.toContain('You are not connected to Supabase');
  });

  /**
   * The whole point of storageMode living only in <request_specific_values> (after
   * CACHE_BREAKPOINT_MARKER) is that stream-text.ts's Anthropic prompt-cache breakpoint still
   * gets a byte-identical prefix regardless of connection state — both tracks' full instructions
   * stay in the static part always. This is the test that actually protects that property.
   */
  it('keeps the static (cacheable) prefix byte-identical across cloud and supabase modes', () => {
    const cloudPrompt = getFineTunedPrompt();
    const supabasePrompt = getFineTunedPrompt('/home/project', {
      isConnected: true,
      hasSelectedProject: true,
      credentials: { supabaseUrl: 'https://x.supabase.co', anonKey: 'anon-key' },
    });

    expect(staticPrefixOf(cloudPrompt)).toBe(staticPrefixOf(supabasePrompt));
  });

  it('both tracks are always present in the static prefix regardless of which mode is active', () => {
    const prompt = getFineTunedPrompt();
    const prefix = staticPrefixOf(prompt);

    expect(prefix).toContain('TRACK A — 코랄레드 Cloud');
    expect(prefix).toContain('TRACK B — 내 Supabase 연결');
  });
});
