import { describe, expect, it } from 'vitest';
import { pickShotList, buildLoopMotionPrompt } from './shotlist';

describe('pickShotList', () => {
  /*
   * Q3 격자 라벨이 그대로 industry로 들어온다(Chat.client → prepareSkeleton7Images). 라벨을 바꾸거나
   * 새로 넣으면 여기서 어느 샷 리스트로 떨어지는지 같이 확인한다 — 안 맞으면 조용히 generic이 된다.
   */
  const byLabel: Array<[string, string]> = [
    ['카페·음식점', 'food'],
    ['미용·뷰티', 'beauty'],
    ['학원·교육', 'education'],
    ['헬스·운동', 'fitness'],
    ['병원·의원', 'clinic'],
    ['쇼핑·판매', 'retail'],
    ['공간·부동산', 'space'],
    ['프리랜서·서비스', 'freelance'],
    ['브랜드 소개·포트폴리오', 'freelance'],
  ];

  it.each(byLabel)('Q3 라벨 "%s"는 %s 샷 리스트로 간다', (label, expectedKey) => {
    const list = pickShotList(label);
    const reference = pickShotList(
      {
        food: '카페',
        beauty: '미용실',
        education: '학원',
        fitness: '헬스장',
        clinic: '병원',
        retail: '쇼핑몰',
        space: '부동산',
        freelance: '프리랜서',
      }[expectedKey]!,
    );

    expect(list).toEqual(reference);
  });

  it('매칭이 없으면 generic으로 떨어진다', () => {
    const unknown = pickShotList('알 수 없는 업종 이름');
    expect(unknown.hero).toContain('signature product');
  });

  it('영상 프롬프트는 샷 리스트의 motion을 쓴다', () => {
    expect(buildLoopMotionPrompt('브랜드 소개·포트폴리오')).toContain(pickShotList('프리랜서').motion);
  });
});
