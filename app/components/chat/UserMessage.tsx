/*
 * @ts-nocheck
 * Preventing TS checks with files presented in the video for a better presentation.
 */
import { MODEL_REGEX, PROVIDER_REGEX, ONBOARDING_ADDITIONS_MARKER } from '~/utils/constants';
import { Markdown } from './Markdown';
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

interface UserMessageProps {
  parts: MessagePart[] | undefined;
}

export function UserMessage({ parts }: UserMessageProps) {
  // Extract images from parts - look for file parts with image mime types
  const images =
    parts?.filter((part): part is FileUIPart => part.type === 'file' && !!part.mediaType?.startsWith('image/')) || [];

  const { text: textContent, additionsCount } = splitDisplayText(parts);

  return (
    <div className="flex flex-col bg-[var(--accent-soft)] backdrop-blur-sm px-5 p-3.5 w-auto rounded-lg ml-auto">
      <div className="flex gap-3.5 mb-4">
        {images.map((item, index) => (
          <div className="relative flex rounded-lg border border-bolt-elements-borderColor overflow-hidden">
            <div className="h-16 w-16 bg-transparent outline-none">
              <img
                key={index}
                src={item.url}
                alt={`Image ${index + 1}`}
                className="h-full w-full rounded-lg"
                style={{ objectFit: 'fill' }}
              />
            </div>
          </div>
        ))}
      </div>
      <Markdown html>{textContent}</Markdown>
      {additionsCount > 0 && (
        <span
          className="mt-2 self-start text-xs font-medium px-2 py-0.5 rounded-full"
          style={{ background: 'var(--accent-ring)', color: 'var(--accent-text)' }}
        >
          답변 {additionsCount}개 반영됨
        </span>
      )}
    </div>
  );
}

/**
 * Strips the [Model:]/[Provider:] routing tags and any inline boltArtifact block from the raw
 * message text, then — if present — cuts the text at ONBOARDING_ADDITIONS_MARKER so only the
 * user's original prompt is shown (the synthesized survey answers after the marker still went to
 * the model in the actual sent message; this only affects what's displayed).
 */
function splitDisplayText(parts: MessagePart[] | undefined): { text: string; additionsCount: number } {
  const content = (parts ?? [])
    .filter((part): part is TextUIPart => part.type === 'text')
    .map((part) => part.text)
    .join('');

  const artifactRegex = /<boltArtifact\s+[^>]*>[\s\S]*?<\/boltArtifact>/gm;
  const cleaned = content.replace(MODEL_REGEX, '').replace(PROVIDER_REGEX, '').replace(artifactRegex, '');

  const markerIndex = cleaned.indexOf(ONBOARDING_ADDITIONS_MARKER);

  if (markerIndex === -1) {
    return { text: cleaned, additionsCount: 0 };
  }

  const additions = cleaned.slice(markerIndex + ONBOARDING_ADDITIONS_MARKER.length);
  const additionsCount = additions.split('\n').filter((line) => line.startsWith('- ')).length;

  return { text: cleaned.slice(0, markerIndex), additionsCount };
}
