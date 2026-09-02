import { useState } from 'react';
import { useParams } from '@remix-run/react';
import { classNames } from '~/utils/classNames';
import { useEditChatDescription } from '~/lib/hooks';
import type { DeployedAppRecord } from '~/lib/deployedApps';
import { MiniBrowserFrame } from '~/components/ui/MiniBrowserFrame';
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

  /** 그룹 안 어떤 대화든 배포돼 있으면 전달된다 — 그 배포 레코드가 대표 항목을 compact 프레임으로 바꾼다. */
  deployedApp?: DeployedAppRecord;
}

export function AppGroup({
  group,
  exportChat,
  onDuplicate,
  onDeleteChat,
  onDeleteGroup,
  defaultExpanded = false,
  deployedApp,
}: AppGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { id: currentUrlId } = useParams();

  const { editing, handleChange, handleBlur, handleSubmit, handleKeyDown, currentDescription, toggleEditMode } =
    useEditChatDescription({
      initialDescription: group.name,
      customChatId: group.representativeId,
    });

  if (editing) {
    return (
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
    );
  }

  const hasMultiple = group.items.length > 1;

  if (deployedApp) {
    const isActive = group.items.some((item) => item.urlId === currentUrlId);

    return (
      <div>
        <div className={classNames(styles.frameGroupRow, { [styles.frameGroupRowActive]: isActive })}>
          <button
            type="button"
            className={styles.frameChevronButton}
            style={hasMultiple ? undefined : { visibility: 'hidden', pointerEvents: 'none' }}
            tabIndex={hasMultiple ? 0 : -1}
            aria-label={expanded ? '접기' : '펼치기'}
            onClick={() => setExpanded((prev) => !prev)}
          >
            <span
              className={classNames('i-ph:caret-right', styles.appGroupChevron, {
                [styles.appGroupChevronOpen]: expanded,
              })}
            />
          </button>
          <a href={`/chat/${group.items[0].urlId}`} className={styles.frameGroupLink}>
            <MiniBrowserFrame
              size="compact"
              url={deployedApp.url}
              title={currentDescription}
              actions={
                <>
                  <button
                    type="button"
                    className={styles.frameActionButton}
                    aria-label="앱 이름 변경"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      toggleEditMode();
                    }}
                  >
                    <span className="i-ph:pencil-fill" />
                  </button>
                  <button
                    type="button"
                    className={styles.frameActionButton}
                    aria-label="앱 삭제"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onDeleteGroup(group);
                    }}
                  >
                    <span className="i-ph:trash" />
                  </button>
                </>
              }
            />
          </a>
        </div>

        {expanded && hasMultiple && (
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

  return (
    <div>
      <div className={styles.appGroupHeader} onClick={() => setExpanded((prev) => !prev)}>
        <span
          className={classNames('i-ph:caret-right', styles.appGroupChevron, {
            [styles.appGroupChevronOpen]: expanded,
          })}
        />
        <span className={styles.appGroupName}>{currentDescription}</span>
        {hasMultiple && <span className={styles.appGroupCount}>{group.items.length}</span>}
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
