import { useState } from 'react';
import { classNames } from '~/utils/classNames';
import { useEditChatDescription } from '~/lib/hooks';
import type { AppGroup as AppGroupData } from './groupChatsByApp';
import { HistoryItem } from './HistoryItem';
import styles from './Sidebar.module.scss';

interface AppGroupProps {
  group: AppGroupData;
  exportChat: (id?: string) => void;
  onDuplicate: (id: string) => void;
  onDeleteChat: (event: React.UIEvent, item: AppGroupData['items'][number]) => void;
  onDeleteGroup: (group: AppGroupData) => void;
  defaultExpanded?: boolean;
}

export function AppGroup({
  group,
  exportChat,
  onDuplicate,
  onDeleteChat,
  onDeleteGroup,
  defaultExpanded = false,
}: AppGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const { editing, handleChange, handleBlur, handleSubmit, handleKeyDown, currentDescription, toggleEditMode } =
    useEditChatDescription({
      initialDescription: group.name,
      customChatId: group.representativeId,
    });

  return (
    <div>
      {editing ? (
        <form onSubmit={handleSubmit} className={styles.appGroupHeader}>
          <input
            type="text"
            className={styles.searchInput}
            autoFocus
            value={currentDescription}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />
          <button type="submit" className={styles.appGroupActionButton} onMouseDown={handleSubmit} aria-label="저장">
            <span className="i-ph:check" />
          </button>
        </form>
      ) : (
        <div className={styles.appGroupHeader} onClick={() => setExpanded((prev) => !prev)}>
          <span
            className={classNames('i-ph:caret-right', styles.appGroupChevron, {
              [styles.appGroupChevronOpen]: expanded,
            })}
          />
          <span className={styles.appGroupName}>{currentDescription}</span>
          {group.items.length > 1 && <span className={styles.appGroupCount}>{group.items.length}</span>}
          <div className={styles.appGroupActions} onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className={styles.appGroupActionButton}
              aria-label="앱 이름 변경"
              onClick={() => toggleEditMode()}
            >
              <span className="i-ph:pencil-fill" />
            </button>
            <button
              type="button"
              className={styles.appGroupActionButton}
              aria-label="앱 삭제"
              onClick={() => onDeleteGroup(group)}
            >
              <span className="i-ph:trash" />
            </button>
          </div>
        </div>
      )}

      {expanded && (
        <div className={styles.appGroupChats}>
          {group.items.map((item) => (
            <HistoryItem
              key={item.id}
              item={item}
              exportChat={exportChat}
              onDuplicate={() => onDuplicate(item.id)}
              onDelete={(event) => onDeleteChat(event, item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
