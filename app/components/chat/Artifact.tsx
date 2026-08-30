import { useStore } from '@nanostores/react';
import { AnimatePresence, motion } from 'framer-motion';
import { computed } from 'nanostores';
import { memo, useEffect, useRef, useState } from 'react';
import { createHighlighter, type BundledLanguage, type BundledTheme, type HighlighterGeneric } from 'shiki';
import type { ActionState } from '~/lib/runtime/action-runner';
import { workbenchStore } from '~/lib/stores/workbench';
import { mobileActiveTabStore } from '~/lib/stores/mobileWorkspace';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { WORK_DIR } from '~/utils/constants';
import { SHOW_DEV_TOOLS } from '~/utils/featureFlags';
import useViewport from '~/lib/hooks';

const highlighterOptions = {
  langs: ['shell'],
  themes: ['light-plus', 'dark-plus'],
};

const shellHighlighter: HighlighterGeneric<BundledLanguage, BundledTheme> =
  import.meta.hot?.data.shellHighlighter ?? (await createHighlighter(highlighterOptions));

if (import.meta.hot) {
  import.meta.hot.data.shellHighlighter = shellHighlighter;
}

interface ArtifactProps {
  messageId: string;
  artifactId: string;
}

/*
 * 채팅 홈·생성 전환 통합 수정 — "화면을 만들고 있어요"/"저장 기능을 붙이고 있어요"/
 * "앱을 준비하고 있어요" 3단계 문구를 실제 액션 파이프라인(파일 경로/타입)에서 휴리스틱으로
 * 뽑아낸다. 파일 경로는 이 판단에만 쓰고 화면엔 절대 노출하지 않는다 — 노출되는 건 아래 세 문구
 * 중 하나뿐이다.
 *
 * 채팅·미리보기 화면 수정 — 이 함수 자체는 지난 라운드에 이미 만들었지만, 호출부(아래 렌더
 * 로직)가 artifact.type === 'bundled'일 때만 이 문구를 쓰고 있었다. LLM은 "bundled" 타입을
 * 쓰지 못하게 금지돼 있어(prompts.ts) 정상 생성의 artifact.type은 사실상 항상 비어 있고, 그
 * "그 외" 경로는 파일 경로·셸 명령이 그대로 보이는 옛 상세 목록으로 빠졌다 — "명령 실행 /
 * npm install && npm run dev"가 노출된 원인. 이제 타입과 무관하게 항상 이 문구를 쓴다.
 */
const STORAGE_PATH_HINT = /\b(data|lib\/db|store|supabase|api|hook)/i;

export function getGenerationPhaseLabel(actions: (ActionState & { id: string })[]): string {
  const runningFileAction = [...actions]
    .reverse()
    .find((action): action is Extract<ActionState, { type: 'file' }> & { id: string } => {
      return action.type === 'file' && action.status === 'running';
    });

  if (runningFileAction?.filePath) {
    return STORAGE_PATH_HINT.test(runningFileAction.filePath) ? '저장 기능을 붙이고 있어요' : '화면을 만들고 있어요';
  }

  const runningSetupAction = actions.find(
    (action) => (action.type === 'shell' || action.type === 'start') && action.status === 'running',
  );

  if (runningSetupAction) {
    return '앱을 준비하고 있어요';
  }

  return '만들고 있어요';
}

export const Artifact = memo(({ artifactId }: ArtifactProps) => {
  const userToggledActions = useRef(false);
  const [showActions, setShowActions] = useState(false);
  const [allActionFinished, setAllActionFinished] = useState(false);
  const isSmallViewport = useViewport(1024);

  const artifacts = useStore(workbenchStore.artifacts);
  const artifact = artifacts[artifactId];

  const actions = useStore(
    computed(artifact.runner.actions, (actions) => {
      /*
       * Filter out Supabase actions except for migrations. Keep the action's own map key (its
       * stable actionId) alongside it so the list below can key on identity instead of index.
       */
      return Object.entries(actions)
        .filter(([, action]) => {
          // Exclude actions with type 'supabase' or actions that contain 'supabase' in their content
          return action.type !== 'supabase' && !(action.type === 'shell' && action.content?.includes('supabase'));
        })
        .map(([id, action]) => ({ id, ...action }));
    }),
  );

  const toggleActions = () => {
    userToggledActions.current = true;
    setShowActions(!showActions);
  };

  useEffect(() => {
    if (actions.length && !showActions && !userToggledActions.current) {
      setShowActions(true);
    }

    if (actions.length !== 0) {
      const finished = !actions.find(
        (action) => action.status !== 'complete' && !(action.type === 'start' && action.status === 'running'),
      );

      if (allActionFinished !== finished) {
        setAllActionFinished(finished);
      }
    }
  }, [actions, artifact.type, allActionFinished]);

  /*
   * 채팅·미리보기 화면 수정 — 예전엔 이 "깔끔한" 제목이 artifact.type === 'bundled'일 때만
   * 나오고, 그 외(사실상 정상 생성의 기본 경로 — LLM은 "bundled" 타입을 쓰지 못하게 금지돼
   * 있어서 artifact.type이 대체로 비어 있다)엔 artifact.title 원문으로 빠졌다. 실제로는 이
   * "그 외" 경로가 평소에 일어나는 경로였다 — 그래서 명령 실행 카드가 그대로 노출됐다. 타입과
   * 무관하게 항상 이 문구를 쓴다.
   */
  const dynamicTitle = allActionFinished
    ? artifact?.id === 'restored-project-setup'
      ? '복원했어요' // Title when restore is complete
      : '다 만들었어요' // Title when initial creation is complete
    : artifact?.id === 'restored-project-setup'
      ? '복원하는 중이에요' // Title during restore
      : '만드는 중이에요'; // Title during initial creation

  return (
    <>
      <div className="artifact relative border border-bolt-elements-borderColor flex flex-col overflow-hidden rounded-[14px] w-full transition-border duration-150">
        {!allActionFinished && (
          <div className="absolute top-0 left-0 right-0 h-[1.5px] overflow-hidden bg-bolt-elements-borderColor z-10">
            <div className="h-full w-1/3 bg-[var(--accent)] animate-[artifact-progress_1.2s_ease-in-out_infinite]" />
          </div>
        )}
        <div className="flex">
          <button
            className="flex items-stretch bg-bolt-elements-artifacts-background hover:bg-bolt-elements-artifacts-backgroundHover w-full overflow-hidden"
            onClick={() => {
              // 모바일 전용 레이아웃: 워크벤치는 아예 렌더되지 않으므로 미리보기 탭으로 전환한다.
              if (isSmallViewport) {
                mobileActiveTabStore.set('preview');
                return;
              }

              const showWorkbench = workbenchStore.showWorkbench.get();
              workbenchStore.showWorkbench.set(!showWorkbench);
            }}
          >
            <div className="px-5 p-3.5 w-full text-left">
              <div className="w-full text-bolt-elements-textPrimary font-medium leading-5 text-sm">
                {/* Use the dynamic title here */}
                {dynamicTitle}
              </div>
              <div className="w-full w-full text-bolt-elements-textSecondary text-xs mt-0.5">
                {isSmallViewport ? '누르면 미리보기가 열려요' : '누르면 작업 화면이 열려요'}
              </div>
            </div>
          </button>
          {/*
              채팅·미리보기 화면 수정 — 파일 경로/셸 명령을 펼쳐 보여주는 상세 목록은 일반
              사용자에게 노출하지 않는다(터미널 로그 노출 금지) — SHOW_DEV_TOOLS일 때만 진입점
              (이 펼치기 화살표) 자체를 보여준다. 기능/코드는 그대로 유지, 진입점만 숨긴다.
          */}
          {SHOW_DEV_TOOLS && <div className="bg-bolt-elements-artifacts-borderColor w-[1px]" />}
          <AnimatePresence>
            {actions.length && SHOW_DEV_TOOLS && (
              <motion.button
                initial={{ width: 0 }}
                animate={{ width: 'auto' }}
                exit={{ width: 0 }}
                transition={{ duration: 0.15, ease: cubicEasingFn }}
                className="bg-bolt-elements-artifacts-background hover:bg-bolt-elements-artifacts-backgroundHover"
                onClick={toggleActions}
              >
                <div className="p-4">
                  <div className={showActions ? 'i-ph:caret-up-bold' : 'i-ph:caret-down-bold'}></div>
                </div>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-2 p-5 bg-bolt-elements-actions-background border-t border-bolt-elements-artifacts-borderColor">
          <div className={classNames('text-lg', getIconColor(allActionFinished ? 'complete' : 'running'))}>
            {allActionFinished ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.2, ease: cubicEasingFn }}
                className="i-ph:check"
              ></motion.div>
            ) : (
              <div
                className="w-2 h-2 rounded-full bg-[var(--accent)] animate-[cr-dot-pulse_1.2s_ease-in-out_infinite]"
                aria-hidden="true"
              />
            )}
          </div>
          <div className="text-bolt-elements-textPrimary font-medium leading-5 text-sm">
            {allActionFinished
              ? artifact.id === 'restored-project-setup'
                ? '저장된 파일을 불러왔어요'
                : '기본 파일을 만들었어요'
              : getGenerationPhaseLabel(actions)}
          </div>
        </div>
        <AnimatePresence>
          {SHOW_DEV_TOOLS && showActions && actions.length > 0 && (
            <motion.div
              className="actions"
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: '0px' }}
              transition={{ duration: 0.15 }}
            >
              <div className="bg-bolt-elements-artifacts-borderColor h-[1px]" />

              <div className="p-5 text-left bg-bolt-elements-actions-background">
                <ActionList actions={actions} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
});

interface ShellCodeBlockProps {
  classsName?: string;
  code: string;
}

function ShellCodeBlock({ classsName, code }: ShellCodeBlockProps) {
  return (
    <div
      className={classNames('text-xs', classsName)}
      dangerouslySetInnerHTML={{
        __html: shellHighlighter.codeToHtml(code, {
          lang: 'shell',
          theme: 'dark-plus',
        }),
      }}
    ></div>
  );
}

interface ActionListProps {
  actions: (ActionState & { id: string })[];
}

const actionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function openArtifactInWorkbench(filePath: any) {
  if (workbenchStore.currentView.get() !== 'code') {
    workbenchStore.currentView.set('code');
  }

  workbenchStore.setSelectedFile(`${WORK_DIR}/${filePath}`);
}

const ActionList = memo(({ actions }: ActionListProps) => {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
      <ul className="list-none space-y-2.5">
        {actions.map((action, index) => {
          const { id, status, type, content } = action;
          const isLast = index === actions.length - 1;

          return (
            <motion.li
              key={id}
              variants={actionVariants}
              initial="hidden"
              animate="visible"
              transition={{
                duration: 0.2,
                ease: cubicEasingFn,
              }}
            >
              <div className="flex items-center gap-1.5 text-sm">
                <div className={classNames('text-lg', getIconColor(action.status))}>
                  {status === 'running' ? (
                    <>
                      {type !== 'start' ? (
                        <div className="i-svg-spinners:90-ring-with-bg"></div>
                      ) : (
                        <div className="i-ph:terminal-window-duotone"></div>
                      )}
                    </>
                  ) : status === 'pending' ? (
                    <div className="i-ph:circle-duotone"></div>
                  ) : status === 'complete' ? (
                    <div className="i-ph:check"></div>
                  ) : status === 'failed' || status === 'aborted' ? (
                    <div className="i-ph:x"></div>
                  ) : null}
                </div>
                {type === 'file' ? (
                  <div>
                    <code
                      className="bg-bolt-elements-artifacts-inlineCode-background text-bolt-elements-artifacts-inlineCode-text px-1.5 py-1 rounded-md text-bolt-elements-item-contentAccent hover:underline cursor-pointer"
                      onClick={() => openArtifactInWorkbench(action.filePath)}
                    >
                      {action.filePath}
                    </code>{' '}
                    만들기
                  </div>
                ) : type === 'shell' ? (
                  <div className="flex items-center w-full min-h-[28px]">
                    <span className="flex-1">명령 실행</span>
                  </div>
                ) : type === 'start' ? (
                  <a
                    onClick={(e) => {
                      e.preventDefault();
                      workbenchStore.currentView.set('preview');
                    }}
                    className="flex items-center w-full min-h-[28px]"
                  >
                    <span className="flex-1">앱 실행</span>
                  </a>
                ) : null}
              </div>
              {(type === 'shell' || type === 'start') && (
                <ShellCodeBlock
                  classsName={classNames('mt-1', {
                    'mb-3.5': !isLast,
                  })}
                  code={content}
                />
              )}
            </motion.li>
          );
        })}
      </ul>
    </motion.div>
  );
});

function getIconColor(status: ActionState['status']) {
  switch (status) {
    case 'pending': {
      return 'text-bolt-elements-textTertiary';
    }
    case 'running': {
      return 'text-bolt-elements-loader-progress';
    }
    case 'complete': {
      return 'text-bolt-elements-icon-success';
    }
    case 'aborted': {
      return 'text-bolt-elements-textSecondary';
    }
    case 'failed': {
      return 'text-bolt-elements-icon-error';
    }
    default: {
      return undefined;
    }
  }
}
