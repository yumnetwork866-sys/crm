import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { WhatsAppTemplateButtonType } from '../../../../../types';
import { DEFAULT_BUTTON_TEXT } from '../../constants/templateConstants';
import type { EditableButton } from '../../types';
import { AddButtonDropdown } from './AddButtonDropdown';
import { EditableButtonItem } from './EditableButtonItem';

export interface ButtonEditorListProps {
  buttons: EditableButton[];
  setButtons: Dispatch<SetStateAction<EditableButton[]>>;
  isDuplicateButtonText: (text: string) => boolean;
  hasDuplicateButtonText: boolean;
}

export const ButtonEditorList = memo(function ButtonEditorList({
  buttons,
  setButtons,
  isDuplicateButtonText,
  hasDuplicateButtonText,
}: ButtonEditorListProps) {
  const [draggedButtonIndex, setDraggedButtonIndex] = useState<number | null>(null);
  const [dragOverButtonIndex, setDragOverButtonIndex] = useState<number | null>(null);
  const buttonCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const pendingScrollButtonId = useRef<string | null>(null);

  useEffect(() => {
    const buttonId = pendingScrollButtonId.current;
    if (!buttonId) return;

    const frame = window.requestAnimationFrame(() => {
      buttonCardRefs.current.get(buttonId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      pendingScrollButtonId.current = null;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [buttons]);

  const moveButton = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;

      setButtons((current) => {
        if (fromIndex >= current.length || toIndex >= current.length) return current;

        const updated = [...current];
        const [moved] = updated.splice(fromIndex, 1);
        if (moved) updated.splice(toIndex, 0, moved);
        return updated;
      });
    },
    [setButtons],
  );

  const addButton = useCallback(
    (type: WhatsAppTemplateButtonType) => {
      const id = crypto.randomUUID();

      setButtons((current) => {
        if (current.length >= 10) return current;

        pendingScrollButtonId.current = id;
        return [
          ...current,
          {
            id,
            type,
            ...(type === 'QUICK_REPLY' ? { quickReplyMode: 'CUSTOM' as const } : {}),
            text: DEFAULT_BUTTON_TEXT[type] || '',
            urlType: 'STATIC',
            url: '',
            urlExample: '',
            phoneCountryIso: 'VN',
            phoneNumber: '',
            activeForDays: 7,
          },
        ];
      });
    },
    [setButtons],
  );

  const updateButton = useCallback(
    (id: string, patch: Partial<EditableButton>) => {
      setButtons((current) =>
        current.map((button) => (button.id === id ? { ...button, ...patch } : button)),
      );
    },
    [setButtons],
  );

  const removeButton = useCallback(
    (id: string) => {
      setButtons((current) => current.filter((button) => button.id !== id));
    },
    [setButtons],
  );

  return (
    <>
      <AddButtonDropdown onAdd={addButton} disabled={buttons.length >= 10} />

      {buttons.length > 0 ? (
        <div
          role="list"
          aria-label="Danh sách button template"
          className="divide-y divide-slate-200 overflow-visible rounded-xl border border-slate-200 bg-slate-50"
        >
          {buttons.map((button, index) => {
            const isDragging = draggedButtonIndex === index;
            const isDragOver = dragOverButtonIndex === index;

            return (
              <div
                key={button.id}
                ref={(element) => {
                  if (element) buttonCardRefs.current.set(button.id, element);
                  else buttonCardRefs.current.delete(button.id);
                }}
                role="listitem"
                draggable={buttons.length > 1}
                onDragStart={(event) => {
                  setDraggedButtonIndex(index);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', String(index));
                }}
                onDragOver={(event) => {
                  if (buttons.length <= 1) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  if (dragOverButtonIndex !== index) setDragOverButtonIndex(index);
                }}
                onDragLeave={() => {
                  if (dragOverButtonIndex === index) setDragOverButtonIndex(null);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggedButtonIndex !== null && draggedButtonIndex !== index) {
                    moveButton(draggedButtonIndex, index);
                  }
                  setDraggedButtonIndex(null);
                  setDragOverButtonIndex(null);
                }}
                onDragEnd={() => {
                  setDraggedButtonIndex(null);
                  setDragOverButtonIndex(null);
                }}
                className={`relative space-y-3 p-3.5 transition-all focus-within:z-40 ${
                  isDragging
                    ? 'bg-indigo-50/40 opacity-40'
                    : isDragOver
                      ? 'bg-indigo-50/70 ring-2 ring-inset ring-indigo-400'
                      : 'hover:bg-slate-100/50'
                }`}
              >
                <EditableButtonItem
                  button={button}
                  index={index}
                  totalButtons={buttons.length}
                  onUpdate={updateButton}
                  onRemove={removeButton}
                  onMove={moveButton}
                  isDuplicate={isDuplicateButtonText(button.text)}
                />
              </div>
            );
          })}
        </div>
      ) : null}

      {hasDuplicateButtonText ? (
        <p role="alert" className="text-right text-xs leading-5 text-rose-600">
          Không thể dùng cùng nội dung cho nhiều button. Vui lòng đặt nội dung khác nhau cho từng
          button.
        </p>
      ) : null}
    </>
  );
});

export default ButtonEditorList;
