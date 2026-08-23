import { describe, expect, it } from 'vitest';
import { mapAnswerToDirectives, mergeDirectives, hueToRepresentativeHex } from './answer-directives';

describe('mapAnswerToDirectives — audience', () => {
  it('solo: adds a prompt addition, no supabase/hue opinion', () => {
    const result = mapAnswerToDirectives('audience', 'solo');
    expect(result.promptAdditions).toHaveLength(1);
    expect(result.connectSupabase).toBeUndefined();
    expect(result.hue).toBeUndefined();
  });

  it('team: adds a distinct prompt addition from solo', () => {
    const solo = mapAnswerToDirectives('audience', 'solo');
    const team = mapAnswerToDirectives('audience', 'team');
    expect(team.promptAdditions).toHaveLength(1);
    expect(team.promptAdditions?.[0]).not.toBe(solo.promptAdditions?.[0]);
  });

  it('public: adds a prompt addition', () => {
    const result = mapAnswerToDirectives('audience', 'public');
    expect(result.promptAdditions).toHaveLength(1);
  });

  it('unsure (null value): falls through to empty', () => {
    expect(mapAnswerToDirectives('audience', null)).toEqual({});
  });

  it('an unrecognized option value: also falls through to empty', () => {
    expect(mapAnswerToDirectives('audience', 'something-not-in-the-bank')).toEqual({});
  });
});

describe('mapAnswerToDirectives — persistence', () => {
  it('withAuth: connectSupabase true + a prompt addition', () => {
    const result = mapAnswerToDirectives('persistence', 'withAuth');
    expect(result.connectSupabase).toBe(true);
    expect(result.promptAdditions).toHaveLength(1);
  });

  it('withoutAuth: connectSupabase true (still persisted, just no login)', () => {
    const result = mapAnswerToDirectives('persistence', 'withoutAuth');
    expect(result.connectSupabase).toBe(true);
  });

  it('none: connectSupabase explicitly false', () => {
    const result = mapAnswerToDirectives('persistence', 'none');
    expect(result.connectSupabase).toBe(false);
  });

  it('unsure: connectSupabase left undefined, not defaulted to false', () => {
    const result = mapAnswerToDirectives('persistence', null);
    expect(result.connectSupabase).toBeUndefined();
    expect(result).toEqual({});
  });
});

describe('mapAnswerToDirectives — device', () => {
  it('mobile: adds a mobile-first prompt addition', () => {
    expect(mapAnswerToDirectives('device', 'mobile').promptAdditions).toHaveLength(1);
  });

  it('desktop: adds a desktop-oriented prompt addition', () => {
    expect(mapAnswerToDirectives('device', 'desktop').promptAdditions).toHaveLength(1);
  });

  it('"both" is treated the same as unsure: empty', () => {
    expect(mapAnswerToDirectives('device', 'both')).toEqual({});
  });
});

describe('mapAnswerToDirectives — mood', () => {
  it('trust: sets hue to 222, no prompt addition', () => {
    const result = mapAnswerToDirectives('mood', 'trust');
    expect(result.hue).toBe(222);
    expect(result.promptAdditions).toBeUndefined();
  });

  it('friendly: sets hue to 33 (brand default)', () => {
    expect(mapAnswerToDirectives('mood', 'friendly').hue).toBe(33);
  });

  it('minimal: no hue, only a prompt addition (kit chroma is fixed)', () => {
    const result = mapAnswerToDirectives('mood', 'minimal');
    expect(result.hue).toBeUndefined();
    expect(result.promptAdditions).toHaveLength(1);
  });

  it('unsure: empty, keeps the brand default hue', () => {
    expect(mapAnswerToDirectives('mood', null)).toEqual({});
  });
});

describe('mapAnswerToDirectives — unknown question id', () => {
  it('returns empty for a question id the mapping has never heard of', () => {
    expect(mapAnswerToDirectives('some-future-question', 'anything')).toEqual({});
  });
});

describe('mergeDirectives', () => {
  it('concatenates promptAdditions across parts in order', () => {
    const merged = mergeDirectives([{ promptAdditions: ['a'] }, { promptAdditions: ['b', 'c'] }]);
    expect(merged.promptAdditions).toEqual(['a', 'b', 'c']);
  });

  it("a later part's connectSupabase overrides an earlier one", () => {
    const merged = mergeDirectives([{ connectSupabase: true }, { connectSupabase: false }]);
    expect(merged.connectSupabase).toBe(false);
  });

  it("a later part's hue overrides an earlier one", () => {
    const merged = mergeDirectives([{ hue: 33 }, { hue: 222 }]);
    expect(merged.hue).toBe(222);
  });

  it('a part with connectSupabase undefined does not clear a previously-set value', () => {
    const merged = mergeDirectives([{ connectSupabase: true }, { promptAdditions: ['x'] }]);
    expect(merged.connectSupabase).toBe(true);
  });

  it('merging an empty list yields an empty promptAdditions array and no opinions', () => {
    const merged = mergeDirectives([]);
    expect(merged).toEqual({ promptAdditions: [] });
  });

  it('merges a realistic full set of onboarding answers into one directive', () => {
    const merged = mergeDirectives([
      mapAnswerToDirectives('audience', 'solo'),
      mapAnswerToDirectives('persistence', 'none'),
      mapAnswerToDirectives('device', 'mobile'),
      mapAnswerToDirectives('mood', 'trust'),
    ]);
    expect(merged.promptAdditions).toHaveLength(3);
    expect(merged.connectSupabase).toBe(false);
    expect(merged.hue).toBe(222);
  });
});

describe('hueToRepresentativeHex', () => {
  it('returns the brand default hex for hue 33', () => {
    expect(hueToRepresentativeHex(33)).toBe('#FF5330');
  });

  it('returns the trust hex for hue 222', () => {
    expect(hueToRepresentativeHex(222)).toBe('#0891B2');
  });

  it('returns undefined for a hue with no representative hex', () => {
    expect(hueToRepresentativeHex(180)).toBeUndefined();
  });
});
