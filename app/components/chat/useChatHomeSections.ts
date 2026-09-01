import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@nanostores/react';
import { authUserStore } from '~/lib/stores/auth';
import { getDeployedApps, type DeployedAppRecord } from '~/lib/deployedApps';
import { db, getAll, type ChatHistoryItem } from '~/lib/persistence';

const MAX_SECTION_ITEMS = 3;

export interface ChatHomeSections {
  /** 최근 대화 중 배포되지 않은 것 최대 3개, 최신순. */
  recentChats: ChatHistoryItem[];

  /** 배포된 앱 최대 3개, 최신순. */
  deployedApps: DeployedAppRecord[];

  /** 1-2: 헤드라인이 "첫 앱" 문구로 갈지 결정 — dedup/최대 3개 제한 전, 진짜 대화가 하나라도 있는지. */
  hasHistory: boolean;

  loaded: boolean;
}

/**
 * "이어서 만들기"·"내가 만든 앱" 두 섹션의 데이터를 한 곳에서 가져온다 — 배포된 대화를 이어서
 * 만들기에서 제외해야 해서(둘 다 배포 데이터를 알아야 함) 컴포넌트 두 개가 각자 fetch하는 대신
 * 여기서 한 번에 계산한다. 둘 다 없으면(첫 방문자) 두 배열 모두 빈 채로 남는다.
 */
export function useChatHomeSections(): ChatHomeSections {
  const authUser = useStore(authUserStore);
  const [allChats, setAllChats] = useState<ChatHistoryItem[]>([]);
  const [allDeployedApps, setAllDeployedApps] = useState<DeployedAppRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      /*
       * 게스트 상태에서는 "이어서 만들기"도 렌더되지 않아야 한다(로그인 여부 조건, 공용 PC 개인정보
       * 조치) — IndexedDB 자체가 계정으로 구분되지 않아 로그인 여부가 유일한 방어선.
       */
      const [chats, deployed] = await Promise.all([
        authUser && db ? getAll(db) : Promise.resolve([]),
        authUser ? getDeployedApps() : Promise.resolve([]),
      ]);

      if (!cancelled) {
        setAllChats(chats);
        setAllDeployedApps(deployed);
        setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authUser]);

  const deployedApps = useMemo(
    () =>
      [...allDeployedApps]
        .sort((a, b) => new Date(b.deployed_at).getTime() - new Date(a.deployed_at).getTime())
        .slice(0, MAX_SECTION_ITEMS),
    [allDeployedApps],
  );

  const recentChats = useMemo(() => {
    // recordDeployedApp이 chat_id에 urlId(있으면)를 쓰므로 둘 다 대조한다.
    const deployedChatIds = new Set(allDeployedApps.map((app) => app.chat_id));

    return allChats
      .filter((chat) => chat.urlId && chat.description)
      .filter((chat) => !deployedChatIds.has(chat.urlId ?? '') && !deployedChatIds.has(chat.id))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, MAX_SECTION_ITEMS);
  }, [allChats, allDeployedApps]);

  const hasHistory = useMemo(() => allChats.some((chat) => chat.urlId && chat.description), [allChats]);

  return { recentChats, deployedApps, hasHistory, loaded };
}
