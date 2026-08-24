import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { logStore } from '~/lib/stores/logs';
import {
  supabaseConnection,
  isConnecting,
  isFetchingStats,
  isFetchingApiKeys,
  updateSupabaseConnection,
  fetchProjectApiKeys,
  initializeSupabaseConnection,
} from '~/lib/stores/supabase';

export function useSupabaseConnection() {
  const connection = useStore(supabaseConnection);
  const connecting = useStore(isConnecting);
  const fetchingStats = useStore(isFetchingStats);
  const fetchingApiKeys = useStore(isFetchingApiKeys);
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [simpleConnecting, setSimpleConnecting] = useState(false);
  const [simpleConnectError, setSimpleConnectError] = useState<string | null>(null);

  useEffect(() => {
    const initConnection = async () => {
      console.log('useSupabaseConnection: Initializing connection...');

      // First, try to initialize from server-side token
      try {
        await initializeSupabaseConnection();
        console.log('useSupabaseConnection: Server-side initialization completed');
      } catch {
        console.log('useSupabaseConnection: Server-side initialization failed, trying localStorage');
      }

      // Then check localStorage for additional data
      const savedConnection = localStorage.getItem('supabase_connection');
      const savedCredentials = localStorage.getItem('supabaseCredentials');

      if (savedConnection) {
        console.log('useSupabaseConnection: Loading from localStorage');

        const parsed = JSON.parse(savedConnection);

        if (savedCredentials && !parsed.credentials) {
          parsed.credentials = JSON.parse(savedCredentials);
        }

        // Only update if we don't already have a connection from server-side
        const currentState = supabaseConnection.get();

        if (!currentState.user) {
          updateSupabaseConnection(parsed);
        }

        if (parsed.token && parsed.selectedProjectId && !parsed.credentials) {
          fetchProjectApiKeys(parsed.selectedProjectId, parsed.token).catch(console.error);
        }
      }
    };

    initConnection();
  }, []);

  const handleConnect = async () => {
    isConnecting.set(true);

    try {
      const cleanToken = connection.token.trim();

      const response = await fetch('/api/supabase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: cleanToken,
        }),
      });

      const data = (await response.json()) as any;

      if (!response.ok) {
        throw new Error(data.error || '연결에 실패했어요');
      }

      updateSupabaseConnection({
        user: data.user,
        token: connection.token,
        stats: data.stats,
      });

      toast.success('Supabase에 연결됐어요');

      setIsProjectsExpanded(true);

      return true;
    } catch (error) {
      console.error('Connection error:', error);
      logStore.logError('Failed to authenticate with Supabase', { error });
      toast.error(error instanceof Error ? error.message : '연결 키가 올바르지 않아요. 다시 확인해주세요.');
      updateSupabaseConnection({ user: null, token: '' });

      return false;
    } finally {
      isConnecting.set(false);
    }
  };

  /**
   * The simplified connect path (project URL + anon key only — no personal access token, no
   * project picker) used by the chat entry point's wizard. Validates both format and that the
   * pair actually works against Supabase's own REST endpoint before marking the app connected,
   * so a typo'd or mismatched key surfaces immediately instead of failing silently later on.
   */
  const handleSimpleConnect = async (rawUrl: string, rawAnonKey: string): Promise<boolean> => {
    const supabaseUrl = rawUrl.trim().replace(/\/+$/, '');
    const anonKey = rawAnonKey.trim();

    setSimpleConnectError(null);

    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl)) {
      setSimpleConnectError('URL 형식이 올바르지 않아요. https://로 시작하는 프로젝트 URL을 확인해주세요.');
      return false;
    }

    if (anonKey.length < 20) {
      setSimpleConnectError('anon key가 올바르지 않아요. 다시 확인해주세요.');
      return false;
    }

    setSimpleConnecting(true);

    try {
      let response: Response;

      try {
        response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
          headers: { apikey: anonKey },
        });
      } catch {
        setSimpleConnectError('네트워크 문제로 연결하지 못했어요. 잠시 후 다시 시도해주세요.');
        return false;
      }

      if (response.status === 401 || response.status === 403) {
        setSimpleConnectError('anon key가 올바르지 않아요. 다시 확인해주세요.');
        return false;
      }

      if (!response.ok) {
        setSimpleConnectError('URL을 찾을 수 없어요. 프로젝트 주소를 다시 확인해주세요.');
        return false;
      }

      updateSupabaseConnection({
        user: null,
        token: '',
        credentials: { supabaseUrl, anonKey },
      });

      toast.success('저장 기능이 켜졌어요');

      return true;
    } finally {
      setSimpleConnecting(false);
    }
  };

  const handleDisconnect = () => {
    updateSupabaseConnection({
      user: null,
      token: '',
      credentials: undefined,
      selectedProjectId: '',
      stats: undefined,
    });
    toast.success('저장 기능 연결을 껐어요');
    setIsDropdownOpen(false);
  };

  const selectProject = async (projectId: string) => {
    const currentState = supabaseConnection.get();
    let projectData = undefined;

    if (projectId && currentState.stats?.projects) {
      projectData = currentState.stats.projects.find((project) => project.id === projectId);
    }

    updateSupabaseConnection({
      selectedProjectId: projectId,
      project: projectData,
    });

    if (projectId && currentState.token) {
      try {
        await fetchProjectApiKeys(projectId, currentState.token);
        toast.success('프로젝트를 선택했어요');
      } catch (error) {
        console.error('Failed to fetch API keys:', error);
        toast.error('프로젝트는 선택됐지만 키를 가져오지 못했어요');
      }
    } else {
      toast.success('프로젝트를 선택했어요');
    }

    setIsDropdownOpen(false);
  };

  const handleCreateProject = async () => {
    window.open('https://app.supabase.com/new/new-project', '_blank');
  };

  return {
    connection,
    connecting,
    fetchingStats,
    fetchingApiKeys,
    isProjectsExpanded,
    setIsProjectsExpanded,
    isDropdownOpen,
    setIsDropdownOpen,
    handleConnect,
    handleSimpleConnect,
    simpleConnecting,
    simpleConnectError,
    handleDisconnect,
    selectProject,
    handleCreateProject,
    updateToken: (token: string) => updateSupabaseConnection({ ...connection, token }),

    /*
     * Single source of truth (app/lib/stores/supabase.ts computes this for both the token+project
     * flow and the simplified credentials-only flow) — no longer recomputed narrowly here.
     */
    isConnected: !!connection.isConnected,
    fetchProjectApiKeys: (projectId: string) => {
      if (connection.token) {
        return fetchProjectApiKeys(projectId, connection.token);
      }

      return Promise.reject(new Error('No token available'));
    },
  };
}
