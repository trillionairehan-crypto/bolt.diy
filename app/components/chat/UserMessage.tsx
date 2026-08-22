/*
 * @ts-nocheck
 * Preventing TS checks with files presented in the video for a better presentation.
 */
import { MODEL_REGEX, PROVIDER_REGEX } from '~/utils/constants';
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

  const textContent = stripMetadata(parts);

  return (
    <div className="flex flex-col bg-accent-500/10 backdrop-blur-sm px-5 p-3.5 w-auto rounded-lg ml-auto">
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
    </div>
  );
}

function stripMetadata(parts: MessagePart[] | undefined) {
  const content = (parts ?? [])
    .filter((part): part is TextUIPart => part.type === 'text')
    .map((part) => part.text)
    .join('');

  const artifactRegex = /<boltArtifact\s+[^>]*>[\s\S]*?<\/boltArtifact>/gm;

  return content.replace(MODEL_REGEX, '').replace(PROVIDER_REGEX, '').replace(artifactRegex, '');
}
