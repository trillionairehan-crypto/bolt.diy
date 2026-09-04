import { createHash } from 'node:crypto';
import { describe, expect, it, afterEach } from 'vitest';
import { getFineTunedPrompt, CACHE_BREAKPOINT_MARKER } from './new-prompt';
import { activePaletteId } from '~/lib/palettes';

function staticPrefixOf(prompt: string): string {
  return prompt.split(CACHE_BREAKPOINT_MARKER)[0];
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
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

/*
 * 온보딩 5문항 전면 개편(2026-09) — Q1/Q3는 유저 메시지 지시문 줄로만 흐르고, Q5는
 * getActivePalette()를 거쳐 designSchemeToHue()의 폴백 경로로만 흐른다(둘 다
 * getFineTunedPrompt의 시그니처를 안 건드림 — Chat.client.tsx가 여전히 designScheme만 넘긴다).
 * 이 테스트는 그 배선이 실제로 캐시 프리픽스를 건드리지 않는지 SHA256 해시로 실측한다 —
 * <request_specific_values>(캐시 경계 뒤)의 --hue 줄 값만 바뀌고, 그 앞 정적 프리픽스는
 * 팔레트가 무엇이든 완전히 동일해야 한다.
 */
describe('getFineTunedPrompt — 온보딩 Q5(팔레트) 변경이 캐시 프리픽스를 깨지 않는다', () => {
  afterEach(() => {
    activePaletteId.set('coral');
  });

  it('activePaletteId가 달라져도 캐시 프리픽스의 SHA256 해시가 동일하다', () => {
    activePaletteId.set('coral');

    const coralPrompt = getFineTunedPrompt();
    const coralPrefixHash = sha256(staticPrefixOf(coralPrompt));

    activePaletteId.set('pink');

    const pinkPrompt = getFineTunedPrompt();
    const pinkPrefixHash = sha256(staticPrefixOf(pinkPrompt));

    activePaletteId.set('dark');

    const darkPrompt = getFineTunedPrompt();
    const darkPrefixHash = sha256(staticPrefixOf(darkPrompt));

    expect(pinkPrefixHash).toBe(coralPrefixHash);
    expect(darkPrefixHash).toBe(coralPrefixHash);
  });

  it('the --hue value itself DOES change in the dynamic suffix (proves the palette is actually wired, not just inert)', () => {
    activePaletteId.set('coral');

    const coralPrompt = getFineTunedPrompt();

    activePaletteId.set('pink');

    const pinkPrompt = getFineTunedPrompt();

    const coralHueLine = coralPrompt.split(CACHE_BREAKPOINT_MARKER)[1].match(/--hue: (\d+)/)?.[1];
    const pinkHueLine = pinkPrompt.split(CACHE_BREAKPOINT_MARKER)[1].match(/--hue: (\d+)/)?.[1];

    expect(coralHueLine).toBeDefined();
    expect(pinkHueLine).toBeDefined();
    expect(pinkHueLine).not.toBe(coralHueLine);
  });
});
