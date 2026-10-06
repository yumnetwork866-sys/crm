import { memo, useState } from 'react';
import { X, Smile } from 'lucide-react';
import { EMOJI_CATEGORIES, RECENT_EMOJIS_STORAGE_KEY } from './emojis';
import type { EmojiCategoryId } from './emojis';

export interface EmojiPickerProps {
  recentEmojis?: string[];
  selectedEmoji?: string;
  onSelect: (emoji: string) => void;
  onClose?: () => void;
  title?: string;
  className?: string;
  bodyMaxHeight?: string;
  theme?: 'indigo' | 'whatsapp' | 'emerald';
}

export const EmojiPicker = memo(function EmojiPicker({
  recentEmojis: propsRecentEmojis,
  selectedEmoji,
  onSelect,
  onClose,
  title,
  className,
  bodyMaxHeight = 'max-h-72',
  theme = 'indigo',
}: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState<EmojiCategoryId>('smileys');
  const [internalRecentEmojis, setInternalRecentEmojis] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(RECENT_EMOJIS_STORAGE_KEY) || '[]');
      return Array.isArray(saved)
        ? saved.filter((item): item is string => typeof item === 'string').slice(0, 8)
        : [];
    } catch {
      return [];
    }
  });

  const effectiveRecentEmojis = propsRecentEmojis ?? internalRecentEmojis;
  const category = EMOJI_CATEGORIES.find((item) => item.id === activeCategory) || EMOJI_CATEGORIES[0];

  const handleEmojiClick = (emoji: string) => {
    onSelect(emoji);
    setInternalRecentEmojis((current) => {
      const next = [emoji, ...current.filter((item) => item !== emoji)].slice(0, 8);
      try {
        localStorage.setItem(RECENT_EMOJIS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const isGreenTheme = theme === 'whatsapp' || theme === 'emerald';
  const activeTabClass = isGreenTheme
    ? 'bg-emerald-50 text-[#1fa855] font-bold shadow-2xs'
    : 'bg-indigo-50 text-indigo-600 font-bold shadow-2xs';

  const renderEmojiGrid = (emojis: readonly string[]) => (
    <div className="grid grid-cols-8 gap-1">
      {emojis.map((emoji, index) => {
        const isSelected = selectedEmoji === emoji;
        return (
          <button
            key={`${emoji}-${index}`}
            type="button"
            onClick={() => handleEmojiClick(emoji)}
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-xl transition hover:bg-slate-100 hover:scale-115 active:scale-95 cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-emerald-500 ${
              isSelected ? 'bg-emerald-100 scale-110 shadow-2xs ring-1 ring-[#1fa855]' : ''
            }`}
            aria-label={`Chèn emoji ${emoji}`}
          >
            {emoji}
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      role="dialog"
      aria-label="Bộ chọn biểu tượng cảm xúc"
      className={
        className ??
        'absolute right-0 bottom-full z-50 mb-2 flex w-80 max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl'
      }
    >
      {(title || onClose) && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50/70">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Smile className={`w-3.5 h-3.5 ${isGreenTheme ? 'text-[#1fa855]' : 'text-indigo-600'}`} />
            {title || 'Biểu tượng cảm xúc'}
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
              title="Đóng bảng emoji"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      <div className={`${bodyMaxHeight} overflow-y-auto p-2 custom-scrollbar`}>
        {effectiveRecentEmojis.length > 0 ? (
          <section className="mb-3">
            <h5 className="mb-1.5 px-1 text-[11px] font-bold text-slate-500">Đã dùng gần đây</h5>
            {renderEmojiGrid(effectiveRecentEmojis)}
          </section>
        ) : null}
        <section>
          <h5 className="mb-1.5 px-1 text-[11px] font-bold text-slate-500">{category.label}</h5>
          {renderEmojiGrid(category.emojis)}
        </section>
      </div>

      <div className="grid grid-cols-8 border-t border-slate-200 bg-white px-1 py-1">
        {EMOJI_CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveCategory(item.id)}
            title={item.label}
            aria-label={item.label}
            aria-pressed={activeCategory === item.id}
            className={`flex h-8 items-center justify-center rounded-md text-base transition cursor-pointer ${
              activeCategory === item.id ? activeTabClass : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
            }`}
          >
            {item.icon}
          </button>
        ))}
      </div>
    </div>
  );
});
