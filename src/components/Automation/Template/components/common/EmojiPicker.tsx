import { memo, useState } from 'react';
import { EMOJI_CATEGORIES } from '../../constants/emojis';
import type { EmojiCategoryId } from '../../constants/emojis';

interface EmojiPickerProps {
  recentEmojis: string[];
  onSelect: (emoji: string) => void;
}

export const EmojiPicker = memo(function EmojiPicker({ recentEmojis, onSelect }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState<EmojiCategoryId>('smileys');
  const category = EMOJI_CATEGORIES.find((item) => item.id === activeCategory) || EMOJI_CATEGORIES[0];

  const renderEmojiGrid = (emojis: readonly string[]) => (
    <div className="grid grid-cols-8 gap-1">
      {emojis.map((emoji, index) => (
        <button
          key={`${emoji}-${index}`}
          type="button"
          onClick={() => onSelect(emoji)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-xl transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500"
          aria-label={`Chèn emoji ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );

  return (
    <div
      role="dialog"
      aria-label="Bộ chọn biểu tượng cảm xúc"
      className="absolute right-0 bottom-full z-50 mb-2 flex w-80 max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
    >
      <div className="max-h-72 overflow-y-auto p-2">
        {recentEmojis.length > 0 ? (
          <section className="mb-3">
            <h5 className="mb-1.5 px-1 text-[11px] font-medium text-slate-500">Đã dùng gần đây</h5>
            {renderEmojiGrid(recentEmojis)}
          </section>
        ) : null}
        <section>
          <h5 className="mb-1.5 px-1 text-[11px] font-medium text-slate-500">{category.label}</h5>
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
            className={`flex h-8 items-center justify-center rounded-md text-base transition ${
              activeCategory === item.id ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {item.icon}
          </button>
        ))}
      </div>
    </div>
  );
});
