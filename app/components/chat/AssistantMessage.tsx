import { memo, Fragment } from 'react';
import { Markdown } from './Markdown';
import Popover from '~/components/ui/Popover';
import { workbenchStore } from '~/lib/stores/workbench';
import { WORK_DIR } from '~/utils/constants';
import WithTooltip from '~/components/ui/Tooltip';
import type { ProviderInfo } from '~/types/model';
import type {
  TextUIPart,
  ReasoningUIPart,
  ReasoningFileUIPart,
  FileUIPart,
  SourceUrlUIPart,
  SourceDocumentUIPart,
  ToolUIPart,
  DynamicToolUIPart,
  StepStartUIPart,
  DataUIPart,
  UIDataTypes,
  CustomContentUIPart,
} from 'ai';
import { ToolInvocations } from './ToolInvocations';
import type { ToolCallAnnotation } from '~/types/context';

type MessagePart =
  | TextUIPart
  | ReasoningUIPart
  | ReasoningFileUIPart
  | FileUIPart
  | SourceUrlUIPart
  | SourceDocumentUIPart
  | ToolUIPart
  | DynamicToolUIPart
  | StepStartUIPart
  | DataUIPart<UIDataTypes>
  | CustomContentUIPart;

interface AssistantMessageProps {
  parsedContent: string;
  messageId?: string;
  onRewind?: (messageId: string) => void;
  onFork?: (messageId: string) => void;
  append?: (message: { text: string }) => void;
  chatMode?: 'discuss' | 'build';
  setChatMode?: (mode: 'discuss' | 'build') => void;
  model?: string;
  provider?: ProviderInfo;
  parts: MessagePart[] | undefined;
  addToolOutput: (input: {
    state?: 'output-available';
    tool: string;
    toolCallId: string;
    output: any;
    errorText?: never;
  }) => void;
}

function openArtifactInWorkbench(filePath: string) {
  filePath = normalizedFilePath(filePath);

  if (workbenchStore.currentView.get() !== 'code') {
    workbenchStore.currentView.set('code');
  }

  workbenchStore.setSelectedFile(`${WORK_DIR}/${filePath}`);
}

function normalizedFilePath(path: string) {
  let normalizedPath = path;

  if (normalizedPath.startsWith(WORK_DIR)) {
    normalizedPath = path.replace(WORK_DIR, '');
  }

  if (normalizedPath.startsWith('/')) {
    normalizedPath = normalizedPath.slice(1);
  }

  return normalizedPath;
}

export const AssistantMessage = memo(
  ({
    parsedContent,
    messageId,
    onRewind,
    onFork,
    append,
    chatMode,
    setChatMode,
    model,
    provider,
    parts,
    addToolOutput,
  }: AssistantMessageProps) => {
    /*
     * v5 UIMessage has no `annotations` field — chatSummary/codeContext/usage/toolCall are now
     * persisted as non-transient `data-*` parts instead, so we read them off `parts`.
     */
    const chatSummary: string | undefined = (parts?.find((p: any) => p.type === 'data-chatSummary') as any)?.data
      ?.summary;
    const codeContext: string[] | undefined = (parts?.find((p: any) => p.type === 'data-codeContext') as any)?.data
      ?.files;

    const usage:
      | {
          completionTokens: number;
          promptTokens: number;
          totalTokens: number;
        }
      | undefined = (parts?.find((p: any) => p.type === 'data-usage') as any)?.data;

    const toolInvocations = parts?.filter((part) => part.type === 'dynamic-tool');
    const toolCallAnnotations = ((parts?.filter((p: any) => p.type === 'data-toolCall') as any[])?.map((p) => p.data) ??
      []) as ToolCallAnnotation[];

    return (
      <div className="overflow-hidden w-full">
        <>
          <div className=" flex gap-2 items-center text-sm text-bolt-elements-textSecondary mb-2">
            {(codeContext || chatSummary) && (
              <Popover side="right" align="start" trigger={<div className="i-ph:info" />}>
                {chatSummary && (
                  <div className="max-w-chat">
                    <div className="summary max-h-96 flex flex-col">
                      <h2 className="border border-bolt-elements-borderColor rounded-md p4">Summary</h2>
                      <div style={{ zoom: 0.7 }} className="overflow-y-auto m4">
                        <Markdown>{chatSummary}</Markdown>
                      </div>
                    </div>
                    {codeContext && (
                      <div className="code-context flex flex-col p4 border border-bolt-elements-borderColor rounded-md">
                        <h2>Context</h2>
                        <div className="flex gap-4 mt-4 bolt" style={{ zoom: 0.6 }}>
                          {codeContext.map((x) => {
                            const normalized = normalizedFilePath(x);
                            return (
                              <Fragment key={normalized}>
                                <code
                                  className="bg-bolt-elements-artifacts-inlineCode-background text-bolt-elements-artifacts-inlineCode-text px-1.5 py-1 rounded-md text-bolt-elements-item-contentAccent hover:underline cursor-pointer"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openArtifactInWorkbench(normalized);
                                  }}
                                >
                                  {normalized}
                                </code>
                              </Fragment>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="context"></div>
              </Popover>
            )}
            <div className="flex w-full items-center justify-between">
              {usage && (
                <div>
                  Tokens: {usage.totalTokens} (prompt: {usage.promptTokens}, completion: {usage.completionTokens})
                </div>
              )}
              {(onRewind || onFork) && messageId && (
                <div className="flex gap-2 flex-col lg:flex-row ml-auto">
                  {onRewind && (
                    <WithTooltip tooltip="Revert to this message">
                      <button
                        onClick={() => onRewind(messageId)}
                        key="i-ph:arrow-u-up-left"
                        className="i-ph:arrow-u-up-left text-xl text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
                      />
                    </WithTooltip>
                  )}
                  {onFork && (
                    <WithTooltip tooltip="Fork chat from this message">
                      <button
                        onClick={() => onFork(messageId)}
                        key="i-ph:git-fork"
                        className="i-ph:git-fork text-xl text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors"
                      />
                    </WithTooltip>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
        <Markdown append={append} chatMode={chatMode} setChatMode={setChatMode} model={model} provider={provider} html>
          {parsedContent}
        </Markdown>
        {toolInvocations && toolInvocations.length > 0 && (
          <ToolInvocations
            toolInvocations={toolInvocations}
            toolCallAnnotations={toolCallAnnotations}
            addToolOutput={addToolOutput}
          />
        )}
      </div>
    );
  },
);
