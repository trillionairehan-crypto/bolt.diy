import React from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { classNames } from '~/utils/classNames';
import { PROVIDER_LIST, SHOW_DEV_TOOLS } from '~/utils/constants';
import { ModelSelector } from '~/components/chat/ModelSelector';
import { APIKeyManager } from './APIKeyManager';
import { LOCAL_PROVIDERS } from '~/lib/stores/settings';
import FilePreview from './FilePreview';
import { ScreenshotStateManager } from './ScreenshotStateManager';
import { SendButton } from './SendButton.client';
import { IconButton } from '~/components/ui/IconButton';
import { toast } from 'react-toastify';
import { SpeechRecognitionButton } from '~/components/chat/SpeechRecognition';
import { ExpoQrModal } from '~/components/workbench/ExpoQrModal';
import styles from './BaseChat.module.scss';
import type { ProviderInfo } from '~/types/model';
import type { DesignScheme } from '~/types/design-scheme';
import type { ElementInfo } from '~/components/workbench/Inspector';
import { WebSearch } from './WebSearch.client';
import { RotatingPlaceholder } from './RotatingPlaceholder';

const SHOW_ENHANCE_BUTTON = false;

/*
 * Landing card is a fixed cream surface regardless of theme (same convention as the coral hero
 * itself — literal hex, not tokens, because this specific surface must NOT flip with dark mode).
 * Every `--bolt-elements-*` variable the card's descendants read (WebSearch popover, IconButton,
 * the Shift+Return kbd hint, etc.) is re-scoped to these values on the card wrapper via inline
 * CSS custom properties, so none of those child components need their own isLanding prop.
 */
const LANDING_CARD_BG = '#FAF7F0';
const LANDING_CARD_BG_2 = '#F2EADD';
const LANDING_INK = '#2B211C';
const LANDING_MUTED = '#8A7A70';
const LANDING_BORDER = '#E8DFD3';
const LANDING_HOVER = 'rgba(43, 33, 28, 0.06)';

interface ChatBoxProps {
  isModelSettingsCollapsed: boolean;
  setIsModelSettingsCollapsed: (collapsed: boolean) => void;
  provider: any;
  providerList: any[];
  modelList: any[];
  apiKeys: Record<string, string>;
  isModelLoading: string | undefined;
  onApiKeysChange: (providerName: string, apiKey: string) => void;
  uploadedFiles: File[];
  imageDataList: string[];
  textareaRef: React.RefObject<HTMLTextAreaElement> | undefined;
  input: string;
  handlePaste: (e: React.ClipboardEvent) => void;
  TEXTAREA_MIN_HEIGHT: number;
  TEXTAREA_MAX_HEIGHT: number;
  isStreaming: boolean;
  handleSendMessage: (event: React.UIEvent, messageInput?: string) => void;
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  chatStarted: boolean;
  exportChat?: () => void;
  qrModalOpen: boolean;
  setQrModalOpen: (open: boolean) => void;
  handleFileUpload: () => void;
  setProvider?: ((provider: ProviderInfo) => void) | undefined;
  model?: string | undefined;
  setModel?: ((model: string) => void) | undefined;
  setUploadedFiles?: ((files: File[]) => void) | undefined;
  setImageDataList?: ((dataList: string[]) => void) | undefined;
  handleInputChange?: ((event: React.ChangeEvent<HTMLTextAreaElement>) => void) | undefined;
  handleStop?: (() => void) | undefined;
  enhancingPrompt?: boolean | undefined;
  enhancePrompt?: (() => void) | undefined;
  onWebSearchResult?: (result: string) => void;
  chatMode?: 'discuss' | 'build';
  setChatMode?: (mode: 'discuss' | 'build') => void;
  designScheme?: DesignScheme;
  setDesignScheme?: (scheme: DesignScheme) => void;
  selectedElement?: ElementInfo | null;
  setSelectedElement?: ((element: ElementInfo | null) => void) | undefined;
  isLanding?: boolean;
}

export const ChatBox: React.FC<ChatBoxProps> = (props) => {
  const isLanding = props.isLanding ?? false;

  return (
    <div
      className={classNames(
        'relative backdrop-blur p-3 relative w-full max-w-chat mx-auto z-prompt',
        isLanding
          ? [
              'rounded-[20px]',
              'shadow-[0_1px_2px_rgba(23,16,14,0.10),0_12px_40px_rgba(23,16,14,0.18)]',
              'focus-within:shadow-[0_1px_2px_rgba(23,16,14,0.10),0_20px_54px_rgba(23,16,14,0.24)]',
              'focus-within:ring-[3px] focus-within:ring-[rgba(250,247,240,0.35)]',
              'focus-within:-translate-y-px',
              'transition-[box-shadow,transform] duration-150 ease-[cubic-bezier(.2,.6,.3,1)]',
            ].join(' ')
          : 'bg-bolt-elements-background-depth-2 rounded-lg border border-bolt-elements-borderColor',

        /*
         * {
         *   'sticky bottom-2': chatStarted,
         * },
         */
      )}
      style={
        isLanding
          ? ({
              background: LANDING_CARD_BG,
              '--bolt-elements-textPrimary': LANDING_INK,
              '--bolt-elements-textSecondary': LANDING_MUTED,
              '--bolt-elements-textTertiary': LANDING_MUTED,
              '--bolt-elements-item-contentDefault': LANDING_MUTED,
              '--bolt-elements-item-contentActive': LANDING_INK,
              '--bolt-elements-item-contentAccent': '#FF5330',
              '--bolt-elements-item-backgroundActive': LANDING_HOVER,
              '--bolt-elements-borderColor': LANDING_BORDER,
              '--bolt-elements-background-depth-1': LANDING_CARD_BG,
              '--bolt-elements-background-depth-2': LANDING_CARD_BG_2,
            } as React.CSSProperties)
          : undefined
      }
    >
      <svg className={classNames(styles.PromptEffectContainer)}>
        <defs>
          <linearGradient
            id="line-gradient"
            x1="20%"
            y1="0%"
            x2="-14%"
            y2="10%"
            gradientUnits="userSpaceOnUse"
            gradientTransform="rotate(-45)"
          >
            <stop offset="0%" stopColor="#FF5330" stopOpacity="0%"></stop>
            <stop offset="40%" stopColor="#FF5330" stopOpacity="80%"></stop>
            <stop offset="50%" stopColor="#FF5330" stopOpacity="80%"></stop>
            <stop offset="100%" stopColor="#FF5330" stopOpacity="0%"></stop>
          </linearGradient>
          <linearGradient id="shine-gradient">
            <stop offset="0%" stopColor="white" stopOpacity="0%"></stop>
            <stop offset="40%" stopColor="#ffffff" stopOpacity="80%"></stop>
            <stop offset="50%" stopColor="#ffffff" stopOpacity="80%"></stop>
            <stop offset="100%" stopColor="white" stopOpacity="0%"></stop>
          </linearGradient>
        </defs>
        <rect className={classNames(styles.PromptEffectLine)} pathLength="100" strokeLinecap="round"></rect>
        <rect className={classNames(styles.PromptShine)} x="48" y="24" width="70" height="1"></rect>
      </svg>
      <div>
        <ClientOnly>
          {() =>
            SHOW_DEV_TOOLS && (
              <div className={props.isModelSettingsCollapsed ? 'hidden' : ''}>
                <ModelSelector
                  key={props.provider?.name + ':' + props.modelList.length}
                  model={props.model}
                  setModel={props.setModel}
                  modelList={props.modelList}
                  provider={props.provider}
                  setProvider={props.setProvider}
                  providerList={props.providerList || (PROVIDER_LIST as ProviderInfo[])}
                  apiKeys={props.apiKeys}
                  modelLoading={props.isModelLoading}
                />
                {(props.providerList || []).length > 0 &&
                  props.provider &&
                  !LOCAL_PROVIDERS.includes(props.provider.name) && (
                    <APIKeyManager
                      provider={props.provider}
                      apiKey={props.apiKeys[props.provider.name] || ''}
                      setApiKey={(key) => {
                        props.onApiKeysChange(props.provider.name, key);
                      }}
                    />
                  )}
              </div>
            )
          }
        </ClientOnly>
      </div>
      <FilePreview
        files={props.uploadedFiles}
        imageDataList={props.imageDataList}
        onRemove={(index) => {
          props.setUploadedFiles?.(props.uploadedFiles.filter((_, i) => i !== index));
          props.setImageDataList?.(props.imageDataList.filter((_, i) => i !== index));
        }}
      />
      <ClientOnly>
        {() => (
          <ScreenshotStateManager
            setUploadedFiles={props.setUploadedFiles}
            setImageDataList={props.setImageDataList}
            uploadedFiles={props.uploadedFiles}
            imageDataList={props.imageDataList}
          />
        )}
      </ClientOnly>
      {props.selectedElement && (
        <div className="flex mx-1.5 gap-2 items-center justify-between rounded-lg rounded-b-none border border-b-none border-bolt-elements-borderColor text-bolt-elements-textPrimary py-1.5 px-2.5 text-xs">
          <div className="flex gap-1.5 items-center min-w-0">
            <div className="i-ph:cursor-click text-sm text-bolt-elements-item-contentAccent shrink-0" />
            <span className="truncate">
              선택:{' '}
              {(props.selectedElement.textContent || '').trim().slice(0, 30) ||
                props.selectedElement.tagName.toLowerCase()}
            </span>
          </div>
          <button
            type="button"
            title="선택 지우기"
            className="shrink-0 bg-transparent text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bolt-elements-focus rounded transition-colors duration-150 ease-out px-1"
            onClick={() => props.setSelectedElement?.(null)}
          >
            지우기
          </button>
        </div>
      )}
      <div
        className={classNames(
          'relative backdrop-blur rounded-lg',
          isLanding ? '' : 'shadow-xs border border-bolt-elements-borderColor',
        )}
      >
        <ClientOnly>
          {() => <RotatingPlaceholder visible={isLanding && props.input.length === 0} color={LANDING_MUTED} />}
        </ClientOnly>
        <textarea
          ref={props.textareaRef}
          data-gramm="false"
          data-gramm_editor="false"
          data-enable-grammarly="false"
          aria-label={isLanding ? '만들고 싶은 것을 설명해주세요' : undefined}
          className={classNames(
            'w-full pl-4 pt-4 pr-16 outline-none resize-none text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary bg-transparent text-sm',
            'transition-all duration-200',
            'hover:border-bolt-elements-focus',
          )}
          onDragEnter={(e) => {
            e.preventDefault();
            e.currentTarget.style.border = '2px solid #1488fc';
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.style.border = '2px solid #1488fc';
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.currentTarget.style.border = '1px solid var(--bolt-elements-borderColor)';
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.style.border = '1px solid var(--bolt-elements-borderColor)';

            const files = Array.from(e.dataTransfer.files);
            files.forEach((file) => {
              if (file.type.startsWith('image/')) {
                const reader = new FileReader();

                reader.onload = (e) => {
                  const base64Image = e.target?.result as string;
                  props.setUploadedFiles?.([...props.uploadedFiles, file]);
                  props.setImageDataList?.([...props.imageDataList, base64Image]);
                };
                reader.readAsDataURL(file);
              }
            });
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              if (event.shiftKey) {
                return;
              }

              event.preventDefault();

              if (props.isStreaming) {
                props.handleStop?.();
                return;
              }

              // ignore if using input method engine
              if (event.nativeEvent.isComposing) {
                return;
              }

              props.handleSendMessage?.(event);
            }
          }}
          value={props.input}
          onChange={(event) => {
            props.handleInputChange?.(event);
          }}
          onPaste={props.handlePaste}
          style={{
            minHeight: isLanding ? Math.max(props.TEXTAREA_MIN_HEIGHT, 88) : props.TEXTAREA_MIN_HEIGHT,
            maxHeight: props.TEXTAREA_MAX_HEIGHT,
          }}
          placeholder={isLanding ? '' : props.chatMode === 'build' ? '어떤 걸 만들고 싶으세요?' : '무엇이든 물어보세요'}
          translate="no"
        />
        <div className="flex flex-nowrap justify-between items-center text-sm p-4 pt-3 w-full">
          <div className="flex flex-nowrap gap-3 items-center min-w-0">
            <IconButton
              title="이미지 첨부"
              className="flex items-center h-8 gap-1.5 px-2 shrink-0 whitespace-nowrap !text-bolt-elements-textSecondary"
              onClick={() => props.handleFileUpload()}
            >
              <div className="i-ph:paperclip text-base"></div>
              <span className={classNames('text-[13px]', isLanding ? 'hidden sm:inline' : 'hidden')}>이미지</span>
            </IconButton>
            <WebSearch
              onSearchResult={(result) => props.onWebSearchResult?.(result)}
              disabled={props.isStreaming}
              showLabel={isLanding}
            />
            {SHOW_ENHANCE_BUTTON && (
              <IconButton
                title="Enhance prompt"
                disabled={props.input.length === 0 || props.enhancingPrompt}
                className={classNames('transition-all', props.enhancingPrompt ? 'opacity-100' : '')}
                onClick={() => {
                  props.enhancePrompt?.();
                  toast.success('Prompt enhanced!');
                }}
              >
                {props.enhancingPrompt ? (
                  <div className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress text-xl animate-spin"></div>
                ) : (
                  <div className="i-bolt:stars text-xl"></div>
                )}
              </IconButton>
            )}

            <SpeechRecognitionButton
              isListening={props.isListening}
              onStart={props.startListening}
              onStop={props.stopListening}
              disabled={props.isStreaming}
              showLabel={isLanding}
            />
            {props.chatStarted && (
              <IconButton
                title="대화 모드"
                className={classNames(
                  'transition-all flex items-center gap-1 px-1.5 shrink-0 whitespace-nowrap',
                  props.chatMode === 'discuss'
                    ? '!bg-bolt-elements-item-backgroundAccent !text-bolt-elements-item-contentAccent'
                    : 'bg-bolt-elements-item-backgroundDefault text-bolt-elements-item-contentDefault',
                )}
                onClick={() => {
                  props.setChatMode?.(props.chatMode === 'discuss' ? 'build' : 'discuss');
                }}
              >
                <div className={`i-ph:chats text-xl`} />
                {props.chatMode === 'discuss' ? <span className="hidden">대화</span> : <span />}
              </IconButton>
            )}
            {SHOW_DEV_TOOLS && (
              <IconButton
                title="모델 설정"
                className={classNames('transition-all flex items-center gap-1', {
                  'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent':
                    props.isModelSettingsCollapsed,
                  'bg-bolt-elements-item-backgroundDefault text-bolt-elements-item-contentDefault':
                    !props.isModelSettingsCollapsed,
                })}
                onClick={() => props.setIsModelSettingsCollapsed(!props.isModelSettingsCollapsed)}
                disabled={!props.providerList || props.providerList.length === 0}
              >
                <div className={`i-ph:caret-${props.isModelSettingsCollapsed ? 'right' : 'down'} text-lg`} />
                {props.isModelSettingsCollapsed ? <span className="text-xs">{props.model}</span> : <span />}
              </IconButton>
            )}
          </div>
          <div className="flex flex-nowrap gap-2 items-center shrink-0">
            {isLanding && props.input.length > 3 ? (
              <div className="hidden sm:block text-xs text-bolt-elements-textTertiary whitespace-nowrap shrink-0">
                <kbd className="kdb px-1.5 py-0.5 rounded bg-bolt-elements-background-depth-2">Shift</kbd> +{' '}
                <kbd className="kdb px-1.5 py-0.5 rounded bg-bolt-elements-background-depth-2">Return</kbd>으로 줄바꿈
              </div>
            ) : null}
            <ClientOnly>
              {() => (
                <div className="shrink-0">
                  <SendButton
                    isStreaming={props.isStreaming}
                    disabled={
                      !props.providerList ||
                      props.providerList.length === 0 ||
                      (!props.isStreaming && props.input.length === 0 && props.uploadedFiles.length === 0)
                    }
                    onClick={(event) => {
                      if (props.isStreaming) {
                        props.handleStop?.();
                        return;
                      }

                      if (props.input.length > 0 || props.uploadedFiles.length > 0) {
                        props.handleSendMessage?.(event);
                      }
                    }}
                  />
                </div>
              )}
            </ClientOnly>
          </div>
          <ExpoQrModal open={props.qrModalOpen} onClose={() => props.setQrModalOpen(false)} />
        </div>
      </div>
    </div>
  );
};
