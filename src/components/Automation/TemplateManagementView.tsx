import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Ban,
  Bell,
  Bold,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Code2,
  FileText,
  GripVertical,
  Image,
  Info,
  Italic,
  KeyRound,
  Link2,
  Loader2,
  LockKeyhole,
  MapPin,
  Megaphone,
  PhoneCall,
  Plus,
  RefreshCw,
  ShieldCheck,
  Smile,
  Strikethrough,
  Trash2,
  Upload,
  Video,
  XCircle,
} from 'lucide-react';
import type {
  CreateWhatsAppTemplateInput,
  WhatsAppApprovedTemplate,
  WhatsAppOtpType,
  WhatsAppTemplateButtonType,
  WhatsAppTemplateCategory,
  WhatsAppTemplateExample,
  WhatsAppTemplateHeaderFormat,
  WhatsAppTemplateParameterFormat,
} from '../../types';
import { api } from '../../utils/apiClient';

interface TemplateManagementViewProps {
  templates: WhatsAppApprovedTemplate[];
  isLoading: boolean;
  error: Error | null;
  onRefetch: () => void;
  onCreateTemplate: (input: CreateWhatsAppTemplateInput) => Promise<unknown>;
  isCreatePending: boolean;
  createError: Error | null;
  onResetCreateError: () => void;
}

type EditableButton = {
  id: string;
  type: WhatsAppTemplateButtonType;
  quickReplyMode?: 'CUSTOM' | 'PRE_CONFIGURED_RESPONSE';
  text: string;
  url: string;
  urlExample: string;
  phoneNumber: string;
};

type WizardStep = 1 | 2 | 3;
type TemplateType = 'DEFAULT' | 'CATALOGUE' | 'FLOWS' | 'CALLING_PERMISSION';

const MARKETING_SETUP_PREVIEW_IMAGES: Record<TemplateType, string> = {
  DEFAULT: '/images/template-types/default.webp',
  CATALOGUE: '/images/template-types/catalogue.gif',
  FLOWS: '/images/template-types/flows.gif',
  CALLING_PERMISSION: '/images/template-types/calling.gif',
};

const UTILITY_SETUP_PREVIEW_IMAGES: Record<Exclude<TemplateType, 'CATALOGUE'>, string> = {
  DEFAULT: '/images/template-types/default_utility.webp',
  FLOWS: '/images/template-types/flow_utility.gif',
  CALLING_PERMISSION: '/images/template-types/calling_utility.gif',
};

const STATUS_CLASSES: Record<string, string> = {
  APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  PENDING: 'border-amber-200 bg-amber-50 text-amber-700',
  REJECTED: 'border-rose-200 bg-rose-50 text-rose-700',
  PAUSED: 'border-orange-200 bg-orange-50 text-orange-700',
  DISABLED: 'border-slate-300 bg-slate-100 text-slate-700',
};

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100';
const labelClass = 'mb-1 block text-xs font-semibold text-slate-700';
const sectionClass = 'space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
const RECENT_EMOJIS_STORAGE_KEY = 'yumcrm_recent_emojis';

const EMOJI_CATEGORIES = [
  {
    id: 'smileys',
    label: 'Mặt cười & con người',
    icon: '🙂',
    emojis: '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🤭 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 👍 👎 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤝 👏 🙌 👐 🤲 🙏 ✍️ 💪'.split(' '),
  },
  {
    id: 'animals',
    label: 'Động vật & thiên nhiên',
    icon: '🐾',
    emojis: '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐻‍❄️ 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐒 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🪱 🐛 🦋 🐌 🐞 🐜 🪰 🪲 🪳 🦟 🦗 🕷️ 🦂 🐢 🐍 🦎 🐙 🦑 🦐 🦞 🦀 🐠 🐟 🐡 🐬 🐳 🦈 🐊 🐅 🐆 🦓 🦍 🦧 🐘 🦛 🦏 🐪 🦒 🦘 🦬 🐃 🐂 🐄 🐎 🐖 🐏 🦙 🐐 🦌 🐕 🐈 🪶 🐇 🐿️ 🦔 🌵 🎄 🌲 🌳 🌴 🪴 🌱 🌿 ☘️ 🍀 🎍 🍃 🍂 🍁 🍄 🐚 🌾 💐 🌷 🌹 🥀 🌺 🌸 🌼 🌻'.split(' '),
  },
  {
    id: 'food',
    label: 'Đồ ăn & thức uống',
    icon: '🍕',
    emojis: '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🍆 🥑 🥦 🥬 🥒 🌶️ 🫑 🌽 🥕 🫒 🧄 🧅 🥔 🍠 🥐 🥯 🍞 🥖 🥨 🧀 🥚 🍳 🧈 🥞 🧇 🥓 🥩 🍗 🍖 🌭 🍔 🍟 🍕 🫓 🥪 🥙 🧆 🌮 🌯 🥗 🥘 🫕 🥫 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🦪 🍤 🍙 🍚 🍘 🍥 🥠 🥮 🍢 🍡 🍧 🍨 🍦 🥧 🧁 🍰 🎂 🍮 🍭 🍬 🍫 🍿 🍩 🍪 🌰 🥜 🍯 🥛 ☕ 🫖 🍵 🧃 🥤 🧋 🍺 🍻 🥂 🍷 🥃 🍸 🍹'.split(' '),
  },
  {
    id: 'activities',
    label: 'Hoạt động',
    icon: '⚽',
    emojis: '⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🪀 🏓 🏸 🏒 🏑 🥍 🏏 🪃 🥅 ⛳ 🪁 🏹 🎣 🤿 🥊 🥋 🎽 🛹 🛼 🛷 ⛸️ 🥌 🎿 ⛷️ 🏂 🪂 🏋️ 🤼 🤸 ⛹️ 🤺 🤾 🏌️ 🏇 🧘 🏄 🏊 🤽 🚣 🧗 🚵 🚴 🏆 🥇 🥈 🥉 🏅 🎖️ 🏵️ 🎗️ 🎫 🎟️ 🎪 🤹 🎭 🩰 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎺 🪗 🎸 🪕 🎻 🎲 ♟️ 🎯 🎳 🎮 🎰 🧩'.split(' '),
  },
  {
    id: 'travel',
    label: 'Du lịch & địa điểm',
    icon: '🚗',
    emojis: '🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🛵 🏍️ 🛺 🚲 🛴 🚨 🚔 🚍 🚘 🚖 🚡 🚠 🚟 🚃 🚋 🚞 🚝 🚄 🚅 🚈 🚂 🚆 🚇 🚊 🚉 ✈️ 🛫 🛬 🛩️ 💺 🛰️ 🚀 🛸 🚁 🛶 ⛵ 🚤 🛥️ 🛳️ ⛴️ 🚢 ⚓ ⛽ 🚧 🚦 🚥 🗺️ 🗿 🗽 🗼 🏰 🏯 🏟️ 🎡 🎢 🎠 ⛲ ⛱️ 🏖️ 🏝️ 🏜️ 🌋 ⛰️ 🏕️ ⛺ 🛖 🏠 🏡 🏢 🏥 🏦 🏨 🏪 🏫 🏭 ⛪ 🕌 🛕 🕍'.split(' '),
  },
  {
    id: 'objects',
    label: 'Đồ vật',
    icon: '💡',
    emojis: '⌚ 📱 💻 ⌨️ 🖥️ 🖨️ 🖱️ 🖲️ 🕹️ 🗜️ 💽 💾 💿 📀 📼 📷 📸 📹 🎥 📽️ 🎞️ 📞 ☎️ 📟 📠 📺 📻 🎙️ 🎚️ 🎛️ 🧭 ⏱️ ⏲️ ⏰ 🕰️ ⌛ ⏳ 📡 🔋 🔌 💡 🔦 🕯️ 🪔 🧯 🛢️ 💸 💵 💴 💶 💷 🪙 💰 💳 💎 ⚖️ 🪜 🧰 🪛 🔧 🔨 ⚒️ 🛠️ ⛏️ 🪚 🔩 ⚙️ 🪤 🧱 ⛓️ 🧲 🔫 💣 🧨 🪓 🔪 🗡️ ⚔️ 🛡️ 🚬 ⚰️ 🪦 ⚱️ 🏺 🔮 📿 🧿 💈 ⚗️ 🔭 🔬 🕳️ 🩹 🩺 💊 💉 🩸 🧬 🦠 🧼 🪥 🧽 🧹 🧺 🧻 🚽 🚿 🛁 🪒 🧴'.split(' '),
  },
  {
    id: 'symbols',
    label: 'Biểu tượng',
    icon: '@',
    emojis: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ☮️ ✝️ ☪️ 🕉️ ☸️ ✡️ 🔯 🕎 ☯️ ☦️ 🛐 ⛎ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ 🆔 ⚛️ ☢️ ☣️ 📴 📳 🈶 🈚 🈸 🈺 🈷️ ✴️ 🆚 💮 🉐 ㊙️ ㊗️ 🈴 🈵 🈹 🈲 🅰️ 🅱️ 🆎 🆑 🅾️ 🆘 ❌ ⭕ 🛑 ⛔ 📛 🚫 💯 💢 ♨️ 🚷 🚯 🚳 🚱 🔞 📵 🚭 ❗ ❕ ❓ ❔ ‼️ ⁉️ 🔅 🔆 ⚠️ 🚸 🔱 ⚜️ 🔰 ♻️ ✅ 🈯 💹 ❇️ ✳️ ❎ 🌐 💠 Ⓜ️ 🌀 💤 🏧 🚾 ♿ 🅿️ 🛗 🛂 🛃 🛄 🛅'.split(' '),
  },
  {
    id: 'flags',
    label: 'Cờ',
    icon: '🏳️',
    emojis: '🏁 🚩 🎌 🏴 🏳️ 🏳️‍🌈 🏳️‍⚧️ 🇺🇳 🇻🇳 🇺🇸 🇬🇧 🇫🇷 🇩🇪 🇮🇹 🇪🇸 🇵🇹 🇳🇱 🇧🇪 🇨🇭 🇦🇹 🇩🇰 🇸🇪 🇳🇴 🇫🇮 🇵🇱 🇨🇿 🇺🇦 🇷🇺 🇨🇦 🇲🇽 🇧🇷 🇦🇷 🇨🇱 🇨🇴 🇵🇪 🇯🇵 🇰🇷 🇨🇳 🇭🇰 🇹🇼 🇸🇬 🇲🇾 🇹🇭 🇮🇩 🇵🇭 🇮🇳 🇵🇰 🇧🇩 🇦🇺 🇳🇿 🇿🇦 🇪🇬 🇸🇦 🇦🇪 🇮🇱 🇹🇷'.split(' '),
  },
] as const;

type EmojiCategoryId = (typeof EMOJI_CATEGORIES)[number]['id'];

const EmojiPicker: React.FC<{
  recentEmojis: string[];
  onSelect: (emoji: string) => void;
}> = ({ recentEmojis, onSelect }) => {
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
    <div className="absolute right-0 bottom-full z-50 mb-2 flex w-80 max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
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
};

function extractVariables(text: string, format: WhatsAppTemplateParameterFormat): string[] {
  const matches = Array.from(text.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g), (match) => match[1].trim());
  const unique = Array.from(new Set(matches));
  return format === 'POSITIONAL' ? unique.sort((a, b) => Number(a) - Number(b)) : unique;
}

function getMetaTemplateBodyErrors(text: string, format: WhatsAppTemplateParameterFormat): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const variables = extractVariables(trimmed, format);
  if (variables.length === 0) return [];

  const errors: string[] = [];

  // Rule 1: Text length / Variable ratio (Meta requires at least 15 non-variable characters per variable)
  const nonVarText = trimmed.replace(/\{\{\s*[^{}]+\s*\}\}/g, '').trim();
  const minRequiredLength = Math.max(15, variables.length * 15);
  if (nonVarText.length < minRequiredLength) {
    errors.push('Mẫu tin nhắn này có quá nhiều biến so với độ dài nội dung. Hãy giảm số lượng biến hoặc tăng độ dài tin nhắn.');
  }

  // Rule 2: Variable at the start, end, or directly adjacent
  if (
    /^\{\{\s*[^{}]+\s*\}\}/.test(trimmed) ||
    /\{\{\s*[^{}]+\s*\}\}$/.test(trimmed) ||
    /\{\{\s*[^{}]+\s*\}\}\s*\{\{\s*[^{}]+\s*\}\}/.test(trimmed)
  ) {
    errors.push('Biến không được đặt ở đầu hoặc cuối mẫu tin nhắn.');
  }

  return errors;
}

function syncExamples(current: WhatsAppTemplateExample[], variables: string[], format: WhatsAppTemplateParameterFormat) {
  return variables.map((variable, index) => ({
    ...(format === 'NAMED' ? { name: variable } : {}),
    value: current.find((example) => example.name === variable)?.value || current[index]?.value || '',
  }));
}

function substituteExamples(text: string, examples: WhatsAppTemplateExample[], format: WhatsAppTemplateParameterFormat) {
  const variables = extractVariables(text, format);
  return text.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match, variable: string) => {
    const index = variables.indexOf(variable.trim());
    const example = format === 'NAMED'
      ? examples.find((item) => item.name === variable.trim())
      : examples[index];
    return example?.value.trim() || match;
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Không thể đọc file media.'));
    reader.readAsDataURL(file);
  });
}

const buttonLabel: Record<WhatsAppTemplateButtonType, string> = {
  QUICK_REPLY: 'Custom',
  URL: 'Visit website',
  VOICE_CALL: 'Call on WhatsApp',
  PHONE_NUMBER: 'Call Phone Number',
  FLOW: 'Complete flow',
  COPY_CODE: 'Copy offer code',
  CONTACT: 'Share contact info',
};

const WHATSAPP_TEMPLATE_LANGUAGES: Array<{ code: string; label: string }> = [
  { code: 'af', label: 'Afrikaans' },
  { code: 'ar', label: 'Arabic' },
  { code: 'ar_EG', label: 'Arabic (EGY)' },
  { code: 'ar_AE', label: 'Arabic (UAE)' },
  { code: 'ar_LB', label: 'Arabic (LBN)' },
  { code: 'ar_MA', label: 'Arabic (MAR)' },
  { code: 'ar_QA', label: 'Arabic (QAT)' },
  { code: 'az', label: 'Azerbaijani' },
  { code: 'be_BY', label: 'Belarusian' },
  { code: 'bn', label: 'Bengali' },
  { code: 'bn_IN', label: 'Bengali (IND)' },
  { code: 'bg', label: 'Bulgarian' },
  { code: 'ca', label: 'Catalan' },
  { code: 'cs', label: 'Czech' },
  { code: 'da', label: 'Danish' },
  { code: 'de_AT', label: 'German (AUT)' },
  { code: 'de_CH', label: 'German (CHE)' },
  { code: 'hr', label: 'Croatian' },
  { code: 'nl', label: 'Dutch' },
  { code: 'en', label: 'English' },
  { code: 'en_AE', label: 'English (UAE)' },
  { code: 'en_AU', label: 'English (AUS)' },
  { code: 'en_CA', label: 'English (CAN)' },
  { code: 'en_GB', label: 'English (UK)' },
  { code: 'en_GH', label: 'English (GHA)' },
  { code: 'en_IE', label: 'English (IRL)' },
  { code: 'en_IN', label: 'English (IND)' },
  { code: 'en_JM', label: 'English (JAM)' },
  { code: 'en_MY', label: 'English (MYS)' },
  { code: 'en_NZ', label: 'English (NZL)' },
  { code: 'en_QA', label: 'English (QAT)' },
  { code: 'en_SG', label: 'English (SGP)' },
  { code: 'en_US', label: 'English (US)' },
  { code: 'en_UG', label: 'English (UGA)' },
  { code: 'en_ZA', label: 'English (ZAF)' },
  { code: 'es', label: 'Spanish' },
  { code: 'es_AR', label: 'Spanish (ARG)' },
  { code: 'es_CL', label: 'Spanish (CHL)' },
  { code: 'es_CO', label: 'Spanish (COL)' },
  { code: 'es_CR', label: 'Spanish (CRI)' },
  { code: 'es_DO', label: 'Spanish (DOM)' },
  { code: 'es_EC', label: 'Spanish (ECU)' },
  { code: 'es_ES', label: 'Spanish (SPA)' },
  { code: 'es_HN', label: 'Spanish (HND)' },
  { code: 'es_MX', label: 'Spanish (MEX)' },
  { code: 'es_PA', label: 'Spanish (PAN)' },
  { code: 'es_PE', label: 'Spanish (PER)' },
  { code: 'es_UY', label: 'Spanish (URY)' },
  { code: 'et', label: 'Estonian' },
  { code: 'fil', label: 'Filipino' },
  { code: 'fi', label: 'Finnish' },
  { code: 'fr', label: 'French' },
  { code: 'fr_BE', label: 'French (BEL)' },
  { code: 'fr_CA', label: 'French (CAN)' },
  { code: 'fr_CH', label: 'French (CHE)' },
  { code: 'fr_CI', label: 'French (CIV)' },
  { code: 'fr_MA', label: 'French (MAR)' },
  { code: 'ka', label: 'Georgian' },
  { code: 'de', label: 'German' },
  { code: 'el', label: 'Greek' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'ha', label: 'Hausa' },
  { code: 'he', label: 'Hebrew' },
  { code: 'hi', label: 'Hindi' },
  { code: 'hu', label: 'Hungarian' },
  { code: 'id', label: 'Indonesian' },
  { code: 'ga', label: 'Irish' },
  { code: 'it', label: 'Italian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'kn', label: 'Kannada' },
  { code: 'kk', label: 'Kazakh' },
  { code: 'ko', label: 'Korean' },
  { code: 'ky_KG', label: 'Kyrgyz (Kyrgyzstan)' },
  { code: 'lo', label: 'Lao' },
  { code: 'lv', label: 'Latvian' },
  { code: 'lt', label: 'Lithuanian' },
  { code: 'mk', label: 'Macedonian' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'ms', label: 'Malay' },
  { code: 'mr', label: 'Marathi' },
  { code: 'nb', label: 'Norwegian' },
  { code: 'nl_BE', label: 'Dutch (BEL)' },
  { code: 'fa', label: 'Persian' },
  { code: 'pl', label: 'Polish' },
  { code: 'prs_AF', label: 'Dari' },
  { code: 'ps_AF', label: 'Pashto' },
  { code: 'pt_BR', label: 'Portuguese (BR)' },
  { code: 'pt_PT', label: 'Portuguese (POR)' },
  { code: 'pa', label: 'Punjabi' },
  { code: 'ro', label: 'Romanian' },
  { code: 'ru', label: 'Russian' },
  { code: 'rw_RW', label: 'Kinyarwanda' },
  { code: 'si_LK', label: 'Sinhala' },
  { code: 'sr', label: 'Serbian' },
  { code: 'sk', label: 'Slovak' },
  { code: 'sl', label: 'Slovenian' },
  { code: 'sq', label: 'Albanian' },
  { code: 'sv', label: 'Swedish' },
  { code: 'sw', label: 'Swahili' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'th', label: 'Thai' },
  { code: 'tr', label: 'Turkish' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'ur', label: 'Urdu' },
  { code: 'uz', label: 'Uzbek' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'zu', label: 'Zulu' },
  { code: 'zh_CN', label: 'Chinese (CHN)' },
  { code: 'zh_HK', label: 'Chinese (HKG)' },
  { code: 'zh_TW', label: 'Chinese (TAI)' },
];

function getTemplateLanguageLabel(code: string) {
  return WHATSAPP_TEMPLATE_LANGUAGES.find((language) => language.code === code)?.label || code;
}

const categoryDescription: Record<WhatsAppTemplateCategory, string> = {
  MARKETING: 'Gửi ưu đãi, thông báo sản phẩm và nội dung giúp tăng nhận diện hoặc tương tác.',
  UTILITY: 'Theo dõi giao dịch, tài khoản, đơn hàng hoặc một yêu cầu cụ thể của khách hàng.',
  AUTHENTICATION: 'Gửi mã xác thực một lần (OTP) để đăng nhập hoặc xác minh tài khoản.',
};

const categoryIcons = {
  MARKETING: Megaphone,
  UTILITY: Bell,
  AUTHENTICATION: KeyRound,
} as const;

const MEDIA_SAMPLE_OPTIONS = [
  { value: 'NONE', label: 'None', icon: Ban },
  { value: 'IMAGE', label: 'Image', icon: Image },
  { value: 'VIDEO', label: 'Video', icon: Video },
  { value: 'DOCUMENT', label: 'Document', icon: FileText },
  { value: 'LOCATION', label: 'Location', icon: MapPin },
] as const;

const MediaSampleDropdown: React.FC<{
  value: WhatsAppTemplateHeaderFormat;
  onChange: (value: WhatsAppTemplateHeaderFormat) => void;
  labelClass: string;
}> = ({ value, onChange, labelClass }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedFormat = ['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(value) ? value : 'NONE';
  const selectedOption = MEDIA_SAMPLE_OPTIONS.find((item) => item.value === selectedFormat) || MEDIA_SAMPLE_OPTIONS[0];
  const SelectedIcon = selectedOption.icon;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative sm:max-w-56" ref={containerRef}>
      <label className={labelClass}>
        Media sample <span className="font-normal text-slate-400">· Optional</span>
      </label>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="mt-1 flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-xs transition hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <SelectedIcon className="h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
          <span className="truncate">{selectedOption.label}</span>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {MEDIA_SAMPLE_OPTIONS.map((item) => {
            const Icon = item.icon;
            const isSelected = item.value === selectedFormat;
            return (
              <button
                key={item.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(item.value);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2.5 px-3 py-2 text-left text-sm transition cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-50 font-semibold text-indigo-700'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-500'}`}
                    aria-hidden="true"
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                {isSelected ? <Check className="h-4 w-4 shrink-0 text-indigo-600" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

const templateButtonIconClass: Record<WhatsAppTemplateButtonType, string> = {
  QUICK_REPLY: 'fa-solid fa-reply',
  URL: 'fa-solid fa-arrow-up-right-from-square',
  VOICE_CALL: 'fa-brands fa-whatsapp',
  PHONE_NUMBER: 'fa-solid fa-phone',
  FLOW: 'fa-solid fa-diagram-project',
  COPY_CODE: 'fa-solid fa-copy',
  CONTACT: 'fa-solid fa-user',
};

const TemplateButtonIcon: React.FC<{ type: WhatsAppTemplateButtonType }> = ({ type }) => (
  <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-emerald-600 template-preview-button-icon" aria-hidden="true">
    <i className={`${templateButtonIconClass[type]} block text-[15px] leading-none`} />
  </span>
);

const AddButtonDropdown: React.FC<{
  onAdd: (type: WhatsAppTemplateButtonType) => void;
  disabled?: boolean;
}> = ({ onAdd, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: Event) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handleClickOutside);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const options: Array<{
    type: WhatsAppTemplateButtonType;
    label: string;
    iconClass: string;
  }> = [
    { type: 'QUICK_REPLY', label: 'Custom', iconClass: templateButtonIconClass.QUICK_REPLY },
    { type: 'URL', label: 'Visit website', iconClass: templateButtonIconClass.URL },
    { type: 'VOICE_CALL', label: 'Call on WhatsApp', iconClass: templateButtonIconClass.VOICE_CALL },
    { type: 'PHONE_NUMBER', label: 'Call Phone Number', iconClass: templateButtonIconClass.PHONE_NUMBER },
    { type: 'FLOW', label: 'Complete flow', iconClass: templateButtonIconClass.FLOW },
    { type: 'COPY_CODE', label: 'Copy offer code', iconClass: templateButtonIconClass.COPY_CODE },
    { type: 'CONTACT', label: 'Share contact info', iconClass: templateButtonIconClass.CONTACT },
  ];

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
      >
        <span>＋ Add button</span>
        <svg
          aria-hidden="true"
          className={`h-2 w-2 fill-slate-600 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 10 6"
        >
          <path d="M0 0l5 6 5-6z" />
        </svg>
      </button>

      {isOpen ? (
        <div
          role="listbox"
          className="absolute bottom-full left-0 z-30 mb-1.5 min-w-47.5 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {options.map((item) => {
            return (
              <button
                key={item.type}
                type="button"
                role="option"
                onClick={() => {
                  onAdd(item.type);
                  setIsOpen(false);
                }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
              >
                <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-slate-500" aria-hidden="true">
                  <i className={`${item.iconClass} block text-[15px] leading-none`} />
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

const categoryPreviewGuidance: Record<WhatsAppTemplateCategory, { suitableFor: string; customizable: string }> = {
  MARKETING: {
    suitableFor: 'Ưu đãi, ra mắt sản phẩm, nhắc giỏ hàng và các chiến dịch tăng tương tác.',
    customizable: 'Header, nội dung, footer, biến cá nhân hóa, media và các button hành động.',
  },
  UTILITY: {
    suitableFor: 'Cập nhật đơn hàng, giao dịch, tài khoản hoặc yêu cầu mà khách hàng đã thực hiện.',
    customizable: 'Header, nội dung giao dịch, footer, biến dữ liệu và button hỗ trợ hoặc tra cứu.',
  },
  AUTHENTICATION: {
    suitableFor: 'Đăng nhập, xác minh danh tính và các luồng cần mã OTP dùng một lần.',
    customizable: 'Thời gian hết hạn, khuyến nghị bảo mật và cách người dùng nhập hoặc sao chép OTP.',
  },
};

export const TemplateManagementView: React.FC<TemplateManagementViewProps> = ({
  templates,
  isLoading,
  error,
  onRefetch,
  onCreateTemplate,
  isCreatePending,
  createError,
  onResetCreateError,
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const formRef = useRef<HTMLFormElement>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLSpanElement>(null);
  const buttonCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const pendingScrollButtonId = useRef<string | null>(null);
  const [templateType, setTemplateType] = useState<TemplateType>('DEFAULT');
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('en');
  const [category, setCategory] = useState<WhatsAppTemplateCategory>('MARKETING');
  const [parameterFormat, setParameterFormat] = useState<WhatsAppTemplateParameterFormat>('POSITIONAL');
  const allowCategoryChange = false;
  const [headerFormat, setHeaderFormat] = useState<WhatsAppTemplateHeaderFormat>('NONE');
  const [headerText, setHeaderText] = useState('');
  const [headerExamples, setHeaderExamples] = useState<WhatsAppTemplateExample[]>([]);
  const [mediaHandle, setMediaHandle] = useState('');
  const [mediaFileName, setMediaFileName] = useState('');
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState('');
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [body, setBody] = useState('');
  const [bodyExamples, setBodyExamples] = useState<WhatsAppTemplateExample[]>([]);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(RECENT_EMOJIS_STORAGE_KEY) || '[]');
      return Array.isArray(saved) ? saved.filter((item): item is string => typeof item === 'string').slice(0, 8) : [];
    } catch {
      return [];
    }
  });
  const [footer, setFooter] = useState('');
  const [buttons, setButtons] = useState<EditableButton[]>([]);
  const [draggedButtonIndex, setDraggedButtonIndex] = useState<number | null>(null);
  const [dragOverButtonIndex, setDragOverButtonIndex] = useState<number | null>(null);

  const moveButton = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    setButtons((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      if (moved) {
        updated.splice(toIndex, 0, moved);
      }
      return updated;
    });
  };

  const [otpType, setOtpType] = useState<WhatsAppOtpType>('COPY_CODE');
  const [otpButtonText, setOtpButtonText] = useState('Sao chép mã');
  const [otpAutofillText, setOtpAutofillText] = useState('Tự động điền');
  const [otpPackage, setOtpPackage] = useState('');
  const [otpSignature, setOtpSignature] = useState('');
  const [otpExpiration, setOtpExpiration] = useState(10);
  const [addSecurityRecommendation, setAddSecurityRecommendation] = useState(true);
  const [zeroTapTermsAccepted, setZeroTapTermsAccepted] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [headerTooltipPosition, setHeaderTooltipPosition] = useState<{ x: number; y: number } | null>(null);

  const bodyVariables = useMemo(() => extractVariables(body, parameterFormat), [body, parameterFormat]);
  const headerVariables = useMemo(() => extractVariables(headerText, parameterFormat), [headerText, parameterFormat]);
  const bodyValidationErrors = useMemo(
    () => (category !== 'AUTHENTICATION' ? getMetaTemplateBodyErrors(body, parameterFormat) : []),
    [body, category, parameterFormat],
  );
  const duplicateButtonTextKeys = useMemo(() => {
    const counts = new Map<string, number>();
    buttons.forEach((button) => {
      const key = button.text.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
    return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([key]) => key));
  }, [buttons]);
  const hasDuplicateButtonText = duplicateButtonTextKeys.size > 0;
  const isDuplicateButtonText = (text: string) => duplicateButtonTextKeys.has(
    text.trim().replace(/\s+/g, ' ').toLocaleLowerCase(),
  );

  useEffect(() => {
    setBodyExamples((current) => syncExamples(current, bodyVariables, parameterFormat));
  }, [bodyVariables, parameterFormat]);

  useEffect(() => {
    setHeaderExamples((current) => syncExamples(current, headerVariables, parameterFormat));
  }, [headerVariables, parameterFormat]);

  useEffect(() => {
    const buttonId = pendingScrollButtonId.current;
    if (!buttonId) return;

    const frame = window.requestAnimationFrame(() => {
      buttonCardRefs.current.get(buttonId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      pendingScrollButtonId.current = null;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [buttons]);

  useEffect(() => () => {
    if (mediaPreviewUrl) URL.revokeObjectURL(mediaPreviewUrl);
  }, [mediaPreviewUrl]);

  useEffect(() => {
    if (!isEmojiPickerOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setIsEmojiPickerOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setIsEmojiPickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isEmojiPickerOpen]);

  useEffect(() => {
    if (!isFormOpen) return;
    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFormOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isFormOpen]);

  const resetForm = () => {
    setWizardStep(1);
    setTemplateType('DEFAULT');
    setName('');
    setLanguage('en');
    setCategory('MARKETING');
    setParameterFormat('POSITIONAL');

    setHeaderFormat('NONE');
    setHeaderText('');
    setHeaderExamples([]);
    setMediaHandle('');
    setMediaFileName('');
    setMediaPreviewUrl('');
    setMediaError('');
    setBody('');
    setBodyExamples([]);
    setFooter('');
    setButtons([]);
    setOtpType('COPY_CODE');
    setOtpButtonText('Sao chép mã');
    setOtpAutofillText('Tự động điền');
    setOtpPackage('');
    setOtpSignature('');
    setOtpExpiration(10);
    setAddSecurityRecommendation(true);
    setZeroTapTermsAccepted(false);
  };

  const addHeaderVariable = () => {
    if (headerVariables.length > 0) return;

    const variable = parameterFormat === 'NAMED' ? '{{variable_name}}' : '{{1}}';
    const input = headerInputRef.current;
    const selectionStart = input?.selectionStart ?? headerText.length;
    const selectionEnd = input?.selectionEnd ?? selectionStart;
    const nextHeaderText = `${headerText.slice(0, selectionStart)}${variable}${headerText.slice(selectionEnd)}`;
    if (nextHeaderText.length > 60) return;

    setHeaderText(nextHeaderText);
    setHeaderFormat('TEXT');
    window.requestAnimationFrame(() => {
      const cursorPosition = selectionStart + variable.length;
      input?.focus();
      input?.setSelectionRange(cursorPosition, cursorPosition);
    });
  };

  const insertBodyText = (text: string) => {
    const input = bodyInputRef.current;
    const selectionStart = input?.selectionStart ?? body.length;
    const selectionEnd = input?.selectionEnd ?? selectionStart;
    const nextBody = `${body.slice(0, selectionStart)}${text}${body.slice(selectionEnd)}`;
    if (nextBody.length > 1024) return;

    setBody(nextBody);
    window.requestAnimationFrame(() => {
      const cursorPosition = selectionStart + text.length;
      input?.focus();
      input?.setSelectionRange(cursorPosition, cursorPosition);
    });
  };

  const replaceBodySelection = (prefix: string, suffix = '', fallback = '') => {
    const input = bodyInputRef.current;
    const selectionStart = input?.selectionStart ?? body.length;
    const selectionEnd = input?.selectionEnd ?? selectionStart;
    const selectedText = body.slice(selectionStart, selectionEnd) || fallback;
    const replacement = `${prefix}${selectedText}${suffix}`;
    const nextBody = `${body.slice(0, selectionStart)}${replacement}${body.slice(selectionEnd)}`;
    if (nextBody.length > 1024) return;

    setBody(nextBody);
    window.requestAnimationFrame(() => {
      const contentStart = selectionStart + prefix.length;
      const contentEnd = contentStart + selectedText.length;
      input?.focus();
      input?.setSelectionRange(contentStart, contentEnd);
    });
  };

  const addBodyVariable = () => {
    const variable = parameterFormat === 'NAMED'
      ? `{{variable_${bodyVariables.length + 1}}}`
      : `{{${bodyVariables.length + 1}}}`;
    insertBodyText(variable);
  };

  const handleEmojiSelect = (emoji: string) => {
    insertBodyText(emoji);
    setRecentEmojis((current) => {
      const next = [emoji, ...current.filter((item) => item !== emoji)].slice(0, 8);
      try {
        localStorage.setItem(RECENT_EMOJIS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Recent emojis are an optional convenience; insertion still works without storage.
      }
      return next;
    });
  };

  const updateExample = (
    setter: React.Dispatch<React.SetStateAction<WhatsAppTemplateExample[]>>,
    index: number,
    value: string,
  ) => setter((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, value } : item));

  const addButton = (type: WhatsAppTemplateButtonType) => {
    const id = crypto.randomUUID();
    pendingScrollButtonId.current = id;
    setButtons((current) => [
      ...current,
      {
        id,
        type,
        ...(type === 'QUICK_REPLY' ? { quickReplyMode: 'CUSTOM' as const } : {}),
        text: type === 'QUICK_REPLY' ? 'Quick Reply' : '',
        url: '',
        urlExample: '',
        phoneNumber: '',
      },
    ]);
  };

  const updateButton = (id: string, patch: Partial<EditableButton>) => {
    setButtons((current) => current.map((button) => button.id === id ? { ...button, ...patch } : button));
  };

  const uploadMedia = async (file?: File) => {
    if (!file) return;
    setMediaError('');
    const maxSizeBytes = headerFormat === 'IMAGE' ? 5 * 1024 * 1024 : 16 * 1024 * 1024;
    const maxSizeLabel = headerFormat === 'IMAGE' ? '5 MB' : '16 MB';
    if (file.size > maxSizeBytes) {
      setMediaError(`File mẫu ${headerFormat === 'IMAGE' ? 'ảnh' : headerFormat === 'VIDEO' ? 'video' : 'tài liệu'} không được vượt quá ${maxSizeLabel}.`);
      return;
    }
    setMediaHandle('');
    setMediaPreviewUrl(file.type.startsWith('image/') ? URL.createObjectURL(file) : '');
    setMediaFileName(file.name);
    setIsUploadingMedia(true);
    try {
      const dataBase64 = await fileToBase64(file);
      const result = await api.post<{ handle: string }>('/campaigns/templates/media', {
        fileName: file.name,
        mimeType: file.type,
        dataBase64,
      });
      setMediaHandle(result.handle);
    } catch (uploadError) {
      setMediaError(uploadError instanceof Error ? uploadError.message : 'Không thể upload file mẫu.');
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const submitTemplate = async () => {
    if (category !== 'AUTHENTICATION' && hasDuplicateButtonText) return;
    onResetCreateError();
    setSuccessMessage('');
    try {
      let input: CreateWhatsAppTemplateInput;
      if (category === 'AUTHENTICATION') {
        input = {
          name: name.trim(),
          language: language.trim(),
          category,
          authentication: {
            addSecurityRecommendation,
            codeExpirationMinutes: otpExpiration,
            otpType,
            button: {
              text: otpButtonText.trim() || undefined,
              ...(otpType !== 'COPY_CODE' ? {
                autofill: otpAutofillText.trim(),
                package: otpPackage.trim(),
                signature: otpSignature.trim(),
              } : {}),
              ...(otpType === 'ZERO_TAP' ? { zeroTapTermsAccepted } : {}),
            },
          },
        };
      } else {
        input = {
          name: name.trim(),
          language: language.trim(),
          category,
          parameterFormat,
          allowCategoryChange,
          header: {
            format: headerFormat,
            ...(headerFormat === 'TEXT' ? {
              text: headerText.trim(),
              examples: headerExamples.map((example) => ({ ...example, value: example.value.trim() })),
            } : {}),
            ...(['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat) ? { mediaHandle } : {}),
          },
          body: body.trim(),
          bodyExamples: bodyExamples.map((example) => ({ ...example, value: example.value.trim() })),
          footer: footer.trim() || undefined,
          buttons: buttons.map(({ id: _id, quickReplyMode: _quickReplyMode, url, urlExample, phoneNumber, ...button }) => ({
            ...button,
            ...(button.type === 'URL' ? { url: url.trim(), urlExample: urlExample.trim() || undefined } : {}),
            ...(button.type === 'PHONE_NUMBER' ? { phoneNumber: phoneNumber.trim() } : {}),
          })),
        };
      }
      await onCreateTemplate(input);
      setSuccessMessage('Template đã được gửi sang Meta và đang chờ xét duyệt.');
      resetForm();
      setIsFormOpen(false);
    } catch {
      // Mutation error is rendered inline.
    }
  };

  const handleWizardSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (wizardStep === 3) void submitTemplate();
  };

  const continueToEditor = () => {
    if (templateType !== 'DEFAULT' && category !== 'AUTHENTICATION') return;
    setWizardStep(2);
  };

  const continueToReview = () => {
    if (category !== 'AUTHENTICATION' && (bodyValidationErrors.length > 0 || hasDuplicateButtonText)) return;
    if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat) && !mediaHandle) {
      setMediaError('Vui lòng upload file mẫu trước khi tiếp tục.');
      return;
    }
    if (!formRef.current?.reportValidity()) return;
    setWizardStep(3);
  };

  const openForm = () => {
    if (isFormOpen) {
      setIsFormOpen(false);
      return;
    }
    resetForm();
    onResetCreateError();
    setSuccessMessage('');
    setIsFormOpen(true);
  };

  const mediaAccept = headerFormat === 'IMAGE'
    ? 'image/jpeg,image/png'
    : headerFormat === 'VIDEO'
      ? 'video/mp4'
      : 'application/pdf';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
            <FileText className="h-4 w-4" />
            <span>WhatsApp Manager</span>
          </div>
          <h2 className="mt-1 text-xl font-bold text-slate-900">Quản lý Message Template</h2>
          <p className="mt-1 text-xs text-slate-500">Tạo component và gửi trực tiếp sang WABA để Meta xét duyệt.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onRefetch} disabled={isLoading} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Tải lại
          </button>
          <button type="button" onClick={openForm} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-500">
            <Plus className="h-4 w-4 text-white" aria-hidden="true" style={{ color: '#ffffff', stroke: '#ffffff' }} /> Tạo template
          </button>
        </div>
      </div>

      {successMessage ? <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{successMessage}</div> : null}

      {isFormOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-2 backdrop-blur-sm sm:p-4"
          onMouseDown={() => setIsFormOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Tạo WhatsApp message template"
            className="relative my-auto max-h-[calc(100vh-1rem)] w-full max-w-370 overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100vh-2rem)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" onClick={() => setIsFormOpen(false)} aria-label="Đóng cửa sổ tạo template" className="absolute right-4 top-4 z-40 rounded-full bg-white p-1 text-slate-400 shadow-sm ring-1 ring-slate-200 hover:text-slate-700">
              <XCircle className="h-5 w-5" />
            </button>
            <form ref={formRef} onSubmit={handleWizardSubmit} className="space-y-5 bg-linear-to-br from-slate-50 via-white to-indigo-50/50 p-3 sm:p-5">
              <WizardProgress step={wizardStep} />
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 space-y-5">
              {wizardStep === 1 ? (
                <>
                  <section className={sectionClass}>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Thiết lập template</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-2 rounded-xl bg-slate-100 p-1 sm:grid-cols-3" role="tablist" aria-label="Template category">
                      {(['MARKETING', 'UTILITY', 'AUTHENTICATION'] as WhatsAppTemplateCategory[]).map((item) => {
                        const CategoryIcon = categoryIcons[item];
                        const isSelected = category === item;

                        return (
                          <button
                            key={item}
                            type="button"
                            role="tab"
                            aria-selected={isSelected}
                            onClick={() => { setCategory(item); setTemplateType('DEFAULT'); }}
                            className={`template-category-tab group relative flex items-center gap-2.5 rounded-lg px-3 py-3 text-left transition ${isSelected ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:bg-white/60'}`}
                          >
                            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                              <CategoryIcon className="template-category-tab-icon h-4 w-4" aria-hidden="true" style={{ color: isSelected ? '#ffffff' : '#334155', stroke: isSelected ? '#ffffff' : '#334155' }} />
                            </span>
                            <span className="block text-sm font-bold">{item === 'MARKETING' ? 'Marketing' : item === 'UTILITY' ? 'Utility' : 'Authentication'}</span>
                            <span
                              role="tooltip"
                              style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
                              className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-30 w-64 -translate-x-1/2 rounded-xl border border-slate-200 p-3 text-left text-xs font-normal leading-5 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                            >
                              {categoryDescription[item]}
                              {item === 'AUTHENTICATION' ? ' Meta tự tạo nội dung OTP theo ngôn ngữ và cài đặt ở bước tiếp theo.' : ''}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                  </section>

                  {category !== 'AUTHENTICATION' ? (
                    <section className={sectionClass}>
                      <div><h3 className="font-bold text-slate-900">Loại template</h3></div>
                      <div className="grid gap-3">
                        {((category === 'UTILITY'
                          ? [
                              ['DEFAULT', 'Default', 'Gửi tin nhắn về một đơn hàng hoặc tài khoản hiện có.'],
                              ['FLOWS', 'Flows', 'Gửi biểu mẫu để thu thập phản hồi, gửi lời nhắc hoặc quản lý đơn hàng.'],
                              ['CALLING_PERMISSION', 'Calling permissions request', 'Hỏi khách hàng xem bạn có thể gọi cho họ trên WhatsApp hay không.'],
                            ]
                          : [
                              ['DEFAULT', 'Default', 'Tạo tin nhắn với header, body, footer và buttons.'],
                              ['CATALOGUE', 'Catalogue', 'Hiển thị sản phẩm từ catalogue của doanh nghiệp.'],
                              ['FLOWS', 'Flows', 'Mở một WhatsApp Flow từ tin nhắn.'],
                              ['CALLING_PERMISSION', 'Calling permissions request', 'Yêu cầu khách hàng cấp quyền gọi.'],
                            ]) as Array<[TemplateType, string, string]>).map(([value, title, description]) => {
                          const disabled = value !== 'DEFAULT';
                          return (
                            <label key={value} className={`relative flex cursor-pointer gap-3 rounded-xl border p-4 transition ${templateType === value ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                              <input type="radio" name="templateType" value={value} checked={templateType === value} onChange={() => setTemplateType(value)} className="mt-1" />
                              <span><span className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900">{title}{disabled ? <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600">Chưa hỗ trợ</span> : null}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span></span>
                            </label>
                          );
                        })}
                      </div>
                    </section>
                  ) : (
                    <section className={sectionClass}>
                      <div><h3 className="font-bold text-slate-900">Loại template</h3><p className="text-xs text-slate-500">Chọn cách gửi mã xác thực cho khách hàng.</p></div>
                      <label className="relative flex cursor-pointer gap-3 rounded-xl border border-indigo-300 bg-indigo-50 p-4">
                        <input type="radio" name="authenticationTemplateType" checked readOnly className="mt-1" />
                        <span>
                          <span className="block text-sm font-bold text-slate-900">One-time passcode</span>
                          <span className="mt-1 block text-xs leading-5 text-slate-500">Gửi mã xác thực dùng một lần để đăng nhập hoặc xác minh tài khoản.</span>
                        </span>
                      </label>
                    </section>
                  )}

                </>
              ) : null}

              {wizardStep === 2 ? (
                <>
                  {category !== 'AUTHENTICATION' ? (() => {
                    const CategoryBadgeIcon = categoryIcons[category];
                    return (
                      <section className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${category === 'MARKETING' ? 'bg-emerald-600' : 'bg-indigo-600'} text-white`}>
                          <CategoryBadgeIcon className="h-5 w-5 text-white" aria-hidden="true" style={{ color: '#ffffff', stroke: '#ffffff' }} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">{name || 'your_template_name'} · {getTemplateLanguageLabel(language)}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">{category === 'MARKETING' ? 'Marketing' : 'Utility'} · Default</p>
                        </div>
                      </section>
                    );
                  })() : null}
                  <section className={sectionClass}>
                    <div><h3 className="font-bold text-slate-900">Template name and language</h3></div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                      <div><label className={labelClass}>Name your template</label><div className="relative"><input required maxLength={512} value={name} onChange={(event) => setName(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="Enter a template name" className={`${inputClass} pr-16`} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">{name.length}/512</span></div></div>
                      <div><label className={labelClass}>Select language</label><select required value={language} onChange={(event) => setLanguage(event.target.value)} className={inputClass}>{WHATSAPP_TEMPLATE_LANGUAGES.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></div>
                    </div>
                  </section>
                  {category === 'AUTHENTICATION' ? (
                  <section className={sectionClass}>
                    <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-indigo-600" /><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Edit template</p><h3 className="font-bold text-slate-900">Authentication và OTP</h3><p className="text-xs text-slate-500">Meta tự tạo nội dung bảo mật theo ngôn ngữ đã chọn.</p></div></div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div><label className={labelClass}>Loại button OTP</label><select value={otpType} onChange={(event) => setOtpType(event.target.value as WhatsAppOtpType)} className={inputClass}><option value="COPY_CODE">COPY_CODE</option><option value="ONE_TAP">ONE_TAP</option><option value="ZERO_TAP">ZERO_TAP</option></select></div>
                      <div>
                        <label className={labelClass}>Nội dung button</label>
                        <div className="relative">
                          <input value={otpButtonText} maxLength={40} onChange={(event) => setOtpButtonText(event.target.value)} placeholder="Tùy chỉnh text button" className={`${inputClass} pr-12`} />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">{otpButtonText.length}/40</span>
                        </div>
                      </div>
                      <div><label className={labelClass}>Mã hết hạn sau (phút)</label><input type="number" min={1} max={90} value={otpExpiration} onChange={(event) => setOtpExpiration(Number(event.target.value))} className={inputClass} /></div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={addSecurityRecommendation} onChange={(event) => setAddSecurityRecommendation(event.target.checked)} /> Thêm khuyến nghị không chia sẻ mã bảo mật.</label>
                    {otpType !== 'COPY_CODE' ? (
                      <div className="grid grid-cols-1 gap-4 rounded-xl border border-indigo-100 bg-indigo-50 p-4 md:grid-cols-3">
                        <div><label className={labelClass}>Nội dung tự động điền</label><input required value={otpAutofillText} maxLength={40} onChange={(event) => setOtpAutofillText(event.target.value)} className={inputClass} /></div>
                        <div><label className={labelClass}>Android package name</label><input required value={otpPackage} onChange={(event) => setOtpPackage(event.target.value)} placeholder="com.example.app" className={inputClass} /></div>
                        <div><label className={labelClass}>App signature hash</label><input required value={otpSignature} onChange={(event) => setOtpSignature(event.target.value)} className={inputClass} /></div>
                        {otpType === 'ZERO_TAP' ? <label className="flex items-center gap-2 text-xs font-medium text-indigo-900 md:col-span-3"><input required type="checkbox" checked={zeroTapTermsAccepted} onChange={(event) => setZeroTapTermsAccepted(event.target.checked)} /> Tôi chấp nhận điều khoản Zero Tap của Meta.</label> : null}
                      </div>
                    ) : null}
                  </section>
                ) : (
                  <>
                    <section className={sectionClass}>
                      <div>
                        <h3 className="font-bold text-slate-900">Content</h3>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Thêm tiêu đề, nội dung và chân trang cho template. Cloud API do Meta lưu trữ sẽ kiểm duyệt các biến và nội dung trong mẫu để bảo vệ tính bảo mật và toàn vẹn của dịch vụ.{' '}
                          <a
                            href="https://developers.facebook.com/docs/whatsapp/message-templates/guidelines/"
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-indigo-600 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-700"
                          >
                            Tìm hiểu thêm
                          </a>
                        </p>
                      </div>
                      <div className="sm:max-w-56">
                        <div className="mb-1 flex items-center gap-1.5">
                          <label className="block text-xs font-semibold text-slate-700">Loại biến</label>
                          <span className="group relative inline-flex">
                            <button
                              type="button"
                              aria-label="Giải thích về biến trong template"
                              aria-describedby="variable-type-tooltip"
                              className="rounded-full text-slate-400 transition hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                            >
                              <Info aria-hidden="true" className="h-3.5 w-3.5" />
                            </button>
                            <span
                              id="variable-type-tooltip"
                              role="tooltip"
                              style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
                              className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 w-72 max-w-[calc(100vw-3rem)] rounded-xl border border-slate-200 p-3 text-xs leading-5 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                            >
                              <span className="block">Biến là các phần giữ chỗ được dùng để chèn động thông tin hoặc dữ liệu cụ thể vào mẫu của bạn. Bạn có thể sử dụng tên hoặc số làm biến.</span>
                              <span className="mt-2 block font-semibold">Ví dụ:</span>
                              <span className="block">Tên: <code>{'{{order_id}}'}</code></span>
                              <span className="block">Số: <code>{'{{1}}'}</code></span>
                            </span>
                          </span>
                        </div>
                        <select
                          value={parameterFormat}
                          onChange={(event) => setParameterFormat(event.target.value as WhatsAppTemplateParameterFormat)}
                          className={inputClass}
                        >
                          <option value="POSITIONAL">Số</option>
                          <option value="NAMED">Tên</option>
                        </select>
                      </div>

                      <MediaSampleDropdown
                        value={headerFormat}
                        onChange={(format) => {
                          setHeaderFormat(format === 'NONE' && headerText.trim() ? 'TEXT' : format);
                          setMediaError('');
                        }}
                        labelClass={labelClass}
                      />
                      {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat) ? (
                        <div>
                          <label className={labelClass}>Upload media sample</label>
                          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-300 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">
                            {isUploadingMedia ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            {isUploadingMedia
                              ? 'Đang upload sang Meta...'
                              : mediaFileName
                                || (headerFormat === 'IMAGE'
                                  ? 'Chọn file ảnh (JPEG, PNG) tối đa 5 MB'
                                  : headerFormat === 'VIDEO'
                                    ? 'Chọn video (MP4) tối đa 16 MB'
                                    : 'Chọn tài liệu (PDF) tối đa 16 MB')}
                            <input
                              disabled={isUploadingMedia}
                              type="file"
                              accept={mediaAccept}
                              onChange={(event) => void uploadMedia(event.target.files?.[0])}
                              className="hidden"
                            />
                          </label>
                          {mediaHandle ? <p className="mt-1 text-[11px] font-medium text-emerald-600">Đã nhận media handle từ Meta.</p> : null}
                          {mediaError ? <p className="mt-1 text-xs font-medium text-rose-600">{mediaError}</p> : null}
                        </div>
                      ) : null}
                      <div
                        className="relative"
                        tabIndex={['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(headerFormat) ? 0 : undefined}
                        aria-describedby={['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(headerFormat) ? 'media-header-tooltip' : undefined}
                        onMouseMove={(event) => {
                          if (!['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(headerFormat)) return;
                          setHeaderTooltipPosition({
                            x: Math.max(8, Math.min(event.clientX + 14, window.innerWidth - 300)),
                            y: Math.max(8, Math.min(event.clientY + 16, window.innerHeight - 72)),
                          });
                        }}
                        onMouseLeave={() => setHeaderTooltipPosition(null)}
                        onFocus={(event) => {
                          if (!['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(headerFormat)) return;
                          const bounds = event.currentTarget.getBoundingClientRect();
                          setHeaderTooltipPosition({
                            x: Math.max(8, Math.min(bounds.left, window.innerWidth - 300)),
                            y: Math.max(8, Math.min(bounds.bottom + 8, window.innerHeight - 72)),
                          });
                        }}
                        onBlur={() => setHeaderTooltipPosition(null)}
                      >
                        <label className={labelClass}>Tiêu đề <span className="font-normal text-slate-400">· Optional</span></label>
                        <div className="relative">
                          <input
                            ref={headerInputRef}
                            disabled={['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(headerFormat)}
                            maxLength={60}
                            value={headerText}
                            onChange={(event) => {
                              const value = event.target.value;
                              setHeaderText(value);
                              setHeaderFormat(value.trim() ? 'TEXT' : 'NONE');
                            }}
                            placeholder={headerFormat === 'LOCATION' ? 'Đã chọn header vị trí (Location)' : 'Add a short line of text to the header of your message'}
                            className={`${inputClass} pr-14 disabled:cursor-not-allowed disabled:bg-slate-100`}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">{headerText.length}/60</span>
                        </div>
                        {!['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(headerFormat) ? (
                          <div className="mt-2 flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={addHeaderVariable}
                              disabled={headerVariables.length > 0 || headerText.length + (parameterFormat === 'NAMED' ? 17 : 5) > 60}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                              Thêm biến
                            </button>
                            <span className="group relative inline-flex">
                              <button
                                type="button"
                                aria-label="Hướng dẫn thêm biến vào tiêu đề"
                                aria-describedby="header-variable-tooltip"
                                className="rounded-full text-slate-400 transition hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                              >
                                <Info aria-hidden="true" className="h-3.5 w-3.5" />
                              </button>
                              <span
                                id="header-variable-tooltip"
                                role="tooltip"
                                style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
                                className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 w-80 max-w-[calc(100vw-3rem)] rounded-xl border border-slate-200 p-3 text-xs leading-5 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                              >
                                Thêm biến bằng cách chọn các cột từ danh sách khách hàng của bạn. Khi tin nhắn được gửi, biến sẽ được thay thế bằng dữ liệu từ cột tương ứng.
                              </span>
                            </span>
                          </div>
                        ) : null}
                        {['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(headerFormat) ? (
                          <span
                            id="media-header-tooltip"
                            role="tooltip"
                            style={{
                              left: headerTooltipPosition?.x ?? -9999,
                              top: headerTooltipPosition?.y ?? -9999,
                              opacity: headerTooltipPosition ? 1 : 0,
                              backgroundColor: '#ffffff',
                              color: '#0f172a',
                            }}
                            className="pointer-events-none fixed z-50 w-72 rounded-xl border border-slate-200 p-3 text-xs font-medium leading-relaxed shadow-xl transition-opacity"
                          >
                            Xóa media để thêm tiêu đề
                          </span>
                        ) : null}
                      </div>

                      <div>
                        <label className={labelClass}>Body</label>
                        <div className="relative">
                          <textarea
                            ref={bodyInputRef}
                            required
                            rows={6}
                            maxLength={1024}
                            value={body}
                            onChange={(event) => setBody(event.target.value)}
                            placeholder={`Nhập text bằng tiếng ${getTemplateLanguageLabel(language)}`}
                            className={`${inputClass} p-3 pb-7 ${bodyValidationErrors.length > 0 ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-100' : ''}`}
                          />
                          <span className="pointer-events-none absolute right-3 bottom-2 text-[10px] text-slate-400">
                            {body.length}/1024
                          </span>
                        </div>
                        {bodyValidationErrors.length > 0 ? (
                          <div className="mt-1.5 space-y-1 text-right">
                            {bodyValidationErrors.map((errMsg) => (
                              <p key={errMsg} className="text-xs leading-5 text-rose-600">
                                {errMsg}
                              </p>
                            ))}
                          </div>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center justify-end gap-1">
                          <span ref={emojiPickerRef} className="relative inline-flex">
                            <button
                              type="button"
                              onClick={() => setIsEmojiPickerOpen((current) => !current)}
                              aria-label="Mở bảng biểu tượng cảm xúc"
                              aria-haspopup="dialog"
                              aria-expanded={isEmojiPickerOpen}
                              title="Biểu tượng cảm xúc"
                              className={`rounded-lg p-1.5 transition focus-visible:outline-2 focus-visible:outline-indigo-500 ${
                                isEmojiPickerOpen ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                              }`}
                            >
                              <Smile aria-hidden="true" className="h-4 w-4" />
                            </button>
                            {isEmojiPickerOpen ? (
                              <EmojiPicker recentEmojis={recentEmojis} onSelect={handleEmojiSelect} />
                            ) : null}
                          </span>
                          <button type="button" onClick={() => replaceBodySelection('*', '*', 'text')} aria-label="In đậm" title="In đậm" className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-indigo-500">
                            <Bold aria-hidden="true" className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => replaceBodySelection('_', '_', 'text')} aria-label="In nghiêng" title="In nghiêng" className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-indigo-500">
                            <Italic aria-hidden="true" className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => replaceBodySelection('~', '~', 'text')} aria-label="Gạch ngang" title="Gạch ngang" className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-indigo-500">
                            <Strikethrough aria-hidden="true" className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => replaceBodySelection('```', '```', 'text')} aria-label="Định dạng monospace" title="Định dạng monospace" className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-indigo-500">
                            <Code2 aria-hidden="true" className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={addBodyVariable} className="ml-1 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-indigo-500">
                            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                            Thêm biến
                          </button>
                          <span className="group relative inline-flex">
                            <button type="button" aria-label="Hướng dẫn thêm biến vào nội dung" aria-describedby="body-variable-tooltip" className="rounded-full p-1.5 text-slate-500 transition hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-indigo-500">
                              <Info aria-hidden="true" className="h-3.5 w-3.5" />
                            </button>
                            <span id="body-variable-tooltip" role="tooltip" style={{ backgroundColor: '#ffffff', color: '#0f172a' }} className="pointer-events-none absolute right-0 bottom-full z-30 mb-2 w-80 max-w-[calc(100vw-3rem)] rounded-xl border border-slate-200 p-3 text-xs leading-5 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                              Thêm biến bằng cách chọn các cột từ danh sách khách hàng của bạn. Khi tin nhắn được gửi, biến sẽ được thay thế bằng dữ liệu từ cột tương ứng.
                            </span>
                          </span>
                        </div>
                      </div>
                      {headerExamples.length > 0 || bodyExamples.length > 0 ? (
                        <VariableSamples
                          headerExamples={headerExamples}
                          bodyExamples={bodyExamples}
                          onHeaderChange={(index, value) => updateExample(setHeaderExamples, index, value)}
                          onBodyChange={(index, value) => updateExample(setBodyExamples, index, value)}
                        />
                      ) : null}
                      <div><label className={labelClass}>Footer <span className="font-normal text-slate-400">· Optional</span></label><div className="relative"><input value={footer} onChange={(event) => setFooter(event.target.value)} maxLength={60} placeholder="Add a short line of text to the bottom of your message" className={`${inputClass} pr-14`} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">{footer.length}/60</span></div></div>
                    </section>
                    <section className={sectionClass}>
                      <div><h3 className="font-bold text-slate-900">Buttons <span className="text-xs font-normal text-slate-400">· Optional</span></h3><p className="mt-1 text-xs text-slate-500">Tạo các button để khách hàng có thể phản hồi tin nhắn của bạn hoặc thực hiện một hành động. Bạn có thể thêm tối đa 10 button. Nếu thêm nhiều hơn 3 button, các button sẽ được hiển thị dưới dạng danh sách.</p></div>
                      <AddButtonDropdown onAdd={(type) => addButton(type)} disabled={buttons.length >= 10} />
                      {buttons.length > 0 ? (
                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 divide-y divide-slate-200">
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
                                  if (dragOverButtonIndex !== index) {
                                    setDragOverButtonIndex(index);
                                  }
                                }}
                                onDragLeave={() => {
                                  if (dragOverButtonIndex === index) {
                                    setDragOverButtonIndex(null);
                                  }
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
                                className={`space-y-3 p-3.5 transition-all ${
                                  isDragging
                                    ? 'opacity-40 bg-indigo-50/40'
                                    : isDragOver
                                      ? 'bg-indigo-50/70 ring-2 ring-inset ring-indigo-400'
                                      : 'hover:bg-slate-100/50'
                                }`}
                              >
                                <div className="flex items-end gap-2.5">
                                  {buttons.length > 1 ? (
                                    <div
                                      title="Kéo thả để sắp xếp thứ tự"
                                      className="flex h-9 w-6 shrink-0 items-center justify-center cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-700 transition"
                                    >
                                      <GripVertical className="h-4 w-4" />
                                    </div>
                                  ) : null}

                                  <div className="w-36 shrink-0 sm:w-48">
                                    <label className={labelClass}>Loại button</label>
                                    {button.type === 'QUICK_REPLY' ? (
                                      <select
                                        value={button.quickReplyMode || 'CUSTOM'}
                                        onChange={(event) => {
                                          const quickReplyMode = event.target.value as 'CUSTOM' | 'PRE_CONFIGURED_RESPONSE';
                                          updateButton(button.id, {
                                            quickReplyMode,
                                            text: quickReplyMode === 'PRE_CONFIGURED_RESPONSE'
                                              ? 'Preconfigured Response'
                                              : 'Quick Reply',
                                          });
                                        }}
                                        className={inputClass}
                                      >
                                        <option value="CUSTOM">Custom</option>
                                        <option value="PRE_CONFIGURED_RESPONSE">Pre-configured response</option>
                                      </select>
                                    ) : (
                                      <select
                                        value={button.type}
                                        onChange={(event) => updateButton(button.id, { type: event.target.value as WhatsAppTemplateButtonType })}
                                        className={inputClass}
                                      >
                                        <option value="URL">Visit website</option>
                                        <option value="VOICE_CALL">Call on WhatsApp</option>
                                        <option value="PHONE_NUMBER">Call Phone Number</option>
                                        <option value="FLOW">Complete flow</option>
                                        <option value="COPY_CODE">Copy offer code</option>
                                        <option value="CONTACT">Share contact info</option>
                                      </select>
                                    )}
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <label className={labelClass}>Nội dung button</label>
                                    <div className="relative">
                                      <input
                                        required
                                        maxLength={40}
                                        value={button.text}
                                        onChange={(event) => updateButton(button.id, { text: event.target.value })}
                                        placeholder="Nhập nội dung button..."
                                        className={`${inputClass} pr-12 ${isDuplicateButtonText(button.text) ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100' : ''}`}
                                      />
                                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                                        {button.text.length}/40
                                      </span>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => setButtons((current) => current.filter((item) => item.id !== button.id))}
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-rose-500 transition hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                                    aria-label="Xóa button"
                                    title="Xóa button"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>

                                {button.type === 'URL' ? (
                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div>
                                      <label className={labelClass}>URL HTTPS</label>
                                      <input
                                        required
                                        type="url"
                                        value={button.url}
                                        onChange={(event) => updateButton(button.id, { url: event.target.value })}
                                        placeholder="https://example.com/{{1}}"
                                        className={inputClass}
                                      />
                                    </div>
                                    <div>
                                      <label className={labelClass}>URL mẫu nếu có biến</label>
                                      <input
                                        value={button.urlExample}
                                        onChange={(event) => updateButton(button.id, { urlExample: event.target.value })}
                                        placeholder="https://example.com/123"
                                        className={inputClass}
                                      />
                                    </div>
                                  </div>
                                ) : null}

                                {button.type === 'PHONE_NUMBER' ? (
                                  <div>
                                    <label className={labelClass}>Số điện thoại (định dạng E.164)</label>
                                    <input
                                      required
                                      value={button.phoneNumber}
                                      onChange={(event) => updateButton(button.id, { phoneNumber: event.target.value })}
                                      placeholder="+842812345678"
                                      className={inputClass}
                                    />
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                      {hasDuplicateButtonText ? (
                        <p role="alert" className="text-right text-xs leading-5 text-rose-600">
                          Không thể dùng cùng nội dung cho nhiều button. Vui lòng đặt nội dung khác nhau cho từng button.
                        </p>
                      ) : null}
                    </section>
                  </>
                )}
                </>
              ) : null}

              {wizardStep === 3 ? (
                <ReviewSections category={category} name={name} language={language} parameterFormat={parameterFormat} headerFormat={headerFormat} headerText={headerText} mediaFileName={mediaFileName} body={body} footer={footer} buttons={buttons} otpType={otpType} otpButtonText={otpButtonText} otpExpiration={otpExpiration} addSecurityRecommendation={addSecurityRecommendation} />
              ) : null}

              {createError ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">{createError.message}</div> : null}
              <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
                <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Hủy</button>
                <div className="ml-auto flex items-center gap-2">
                  {wizardStep > 1 ? <button type="button" onClick={() => setWizardStep((wizardStep - 1) as WizardStep)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" />Quay lại</button> : null}
                  {wizardStep === 1 ? <button type="button" onClick={continueToEditor} disabled={templateType !== 'DEFAULT' && category !== 'AUTHENTICATION'} className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">Tiếp tục</button> : null}
                  {wizardStep === 2 ? <button type="button" onClick={continueToReview} disabled={isUploadingMedia || (category !== 'AUTHENTICATION' && (bodyValidationErrors.length > 0 || hasDuplicateButtonText))} className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">Tiếp tục</button> : null}
                  {wizardStep === 3 ? <button type="submit" disabled={isCreatePending || isUploadingMedia} className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">{isCreatePending ? 'Đang gửi Meta...' : 'Gửi xét duyệt'}</button> : null}
                </div>
              </div>
            </div>

            <div className="w-full lg:sticky lg:top-5 lg:w-90">
              <TemplatePreview wizardStep={wizardStep} templateType={templateType} category={category} headerFormat={headerFormat} headerText={headerText} headerExamples={headerExamples} mediaFileName={mediaFileName} mediaPreviewUrl={mediaPreviewUrl} body={body} bodyExamples={bodyExamples} footer={footer} buttons={buttons} parameterFormat={parameterFormat} otpType={otpType} otpButtonText={otpButtonText} otpExpiration={otpExpiration} addSecurityRecommendation={addSecurityRecommendation} />
            </div>
          </div>
            </form>
          </div>
        </div>
      ) : null}

      {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">{error.message}</div> : null}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{templates.map((template) => <TemplateCard key={`${template.name}::${template.language}`} template={template} />)}</div>
      {!isLoading && !error && templates.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-500">WABA chưa có template nào.</div> : null}
    </div>
  );
};

const WizardProgress: React.FC<{ step: WizardStep }> = ({ step }) => {
  const steps = ['Set up template', 'Edit template', 'Submit for Review'];
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-5 shadow-sm sm:px-8">
      <ol className="grid grid-cols-3">
        {steps.map((label, index) => {
          const number = (index + 1) as WizardStep;
          const complete = number < step;
          const active = number === step;
          return (
            <li key={label} className="relative flex min-w-0 flex-col items-center text-center">
              {index > 0 ? <span className={`absolute right-1/2 top-4 h-0.5 w-full ${number <= step ? 'bg-indigo-500' : 'bg-slate-200'}`} /> : null}
              <span className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold ${complete ? 'border-indigo-600 bg-indigo-600 text-white' : active ? 'border-indigo-600 bg-white text-indigo-700' : 'border-slate-300 bg-white text-slate-400'}`}>{complete ? <Check className="h-4 w-4 text-white" aria-hidden="true" style={{ color: '#ffffff', stroke: '#ffffff' }} /> : number}</span>
              <span className={`relative mt-2 text-[10px] font-bold leading-4 sm:text-xs ${active || complete ? 'text-slate-900' : 'text-slate-400'}`}>{label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

const TemplatePreview: React.FC<{
  wizardStep: WizardStep;
  templateType: TemplateType;
  category: WhatsAppTemplateCategory;
  headerFormat: WhatsAppTemplateHeaderFormat;
  headerText: string;
  headerExamples: WhatsAppTemplateExample[];
  mediaFileName: string;
  mediaPreviewUrl: string;
  body: string;
  bodyExamples: WhatsAppTemplateExample[];
  footer: string;
  buttons: EditableButton[];
  parameterFormat: WhatsAppTemplateParameterFormat;
  otpType: WhatsAppOtpType;
  otpButtonText: string;
  otpExpiration: number;
  addSecurityRecommendation: boolean;
}> = ({ wizardStep, templateType, category, headerFormat, headerText, headerExamples, mediaFileName, mediaPreviewUrl, body, bodyExamples, footer, buttons, parameterFormat, otpType, otpButtonText, otpExpiration, addSecurityRecommendation }) => {
  const previewHeader = substituteExamples(headerText, headerExamples, parameterFormat);
  const previewBody = substituteExamples(body, bodyExamples, parameterFormat);
  const showSetupIllustration = wizardStep === 1;
  const setupPreviewImage = category === 'AUTHENTICATION'
    ? '/images/template-types/otp.webp'
    : category === 'UTILITY' && templateType !== 'CATALOGUE'
      ? UTILITY_SETUP_PREVIEW_IMAGES[templateType]
      : MARKETING_SETUP_PREVIEW_IMAGES[templateType];
  return (
    <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3"><h3 className="text-sm font-bold text-slate-900">Template preview</h3></div>
      <div className={`min-h-107.5 bg-[#efeae2] ${showSetupIllustration ? 'p-0' : 'p-4'}`} style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,.55) 0 1px, transparent 1px)', backgroundSize: '16px 16px' }}>
        {showSetupIllustration ? (
          <div className="relative flex min-h-107.5 w-full items-center justify-center overflow-hidden bg-[#f7f2e9]">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-xs text-slate-500">
              <Image className="h-8 w-8" />
              <span>Thêm ảnh vào</span>
              <code className="break-all rounded bg-white px-2 py-1 text-[10px]">{setupPreviewImage}</code>
            </div>
            <img
              key={setupPreviewImage}
              src={setupPreviewImage}
              alt={`Minh họa ${templateType.toLowerCase()} template`}
              className="relative z-10 block h-auto w-full bg-[#f7f2e9]"
              onError={(event) => { event.currentTarget.style.display = 'none'; }}
            />
          </div>
        ) : (
        <div className="ml-auto max-w-[94%] overflow-hidden rounded-lg rounded-tr-none bg-white shadow-sm">
          {category === 'AUTHENTICATION' ? (
            <><div className="space-y-3 p-3"><div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><LockKeyhole className="h-4 w-4 text-emerald-600" /> Mã xác thực của bạn</div><p className="text-sm leading-5 text-slate-700">Mã xác thực của bạn là <strong>123456</strong>.</p>{addSecurityRecommendation ? <p className="text-xs text-slate-600">Để bảo mật, đừng chia sẻ mã này.</p> : null}<p className="text-[11px] text-slate-500">Mã này sẽ hết hạn sau {otpExpiration} phút.</p><div className="text-right text-[10px] text-slate-400">{new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div></div><div className="border-t border-slate-100 p-2"><div className="flex items-center justify-center gap-2 rounded-md py-1.5 text-xs font-semibold text-emerald-600" style={{ color: '#059669' }}>{otpType === 'COPY_CODE' ? <TemplateButtonIcon type="COPY_CODE" /> : <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 template-preview-button-icon" style={{ color: '#059669', stroke: '#059669' }} />}<span className="text-emerald-600" style={{ color: '#059669' }}>{otpButtonText || (otpType === 'COPY_CODE' ? 'Sao chép mã' : 'Tự động điền')}</span></div></div></>
          ) : (
            <>{headerFormat !== 'NONE' ? <div>{headerFormat === 'TEXT' ? <div className="px-3 pt-3 text-sm font-bold text-slate-900">{previewHeader || 'Nội dung header'}</div> : headerFormat === 'LOCATION' ? <div className="flex h-32 flex-col items-center justify-center gap-1.5 bg-slate-100 px-3 text-center text-xs text-slate-600"><div className="flex items-center gap-1.5 font-bold text-slate-800"><MapPin className="h-4.5 w-4.5 text-rose-600" /><span>Vị trí (Location)</span></div><span className="text-[11px] text-slate-400">Vị trí địa lý sẽ được đính kèm khi gửi</span></div> : <div className="flex h-36 flex-col items-center justify-center gap-2 bg-slate-100 px-3 text-center text-xs text-slate-500">{headerFormat === 'IMAGE' && mediaPreviewUrl ? <img src={mediaPreviewUrl} alt={mediaFileName || 'Ảnh mẫu template'} className="h-full w-full object-cover" /> : headerFormat === 'VIDEO' ? <><span><Video className="h-8 w-8" /></span><span className="max-w-full truncate">{mediaFileName || 'video mẫu'}</span></> : <><span>{headerFormat === 'IMAGE' ? <Image className="h-8 w-8" /> : <FileText className="h-8 w-8" />}</span><span className="max-w-full truncate">{mediaFileName || `${headerFormat.toLowerCase()} mẫu`}</span></>}</div>}</div> : null}<div className="space-y-2 px-3 pb-2 pt-3">{previewBody ? <p className="whitespace-pre-wrap text-sm leading-5 text-slate-700">{previewBody}</p> : null}{footer ? <p className="text-[11px] text-slate-500">{footer}</p> : null}<div className="text-right text-[10px] text-slate-400">{new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div></div>{buttons.length > 0 ? <div className="divide-y divide-slate-100 border-t border-slate-100 px-2">{buttons.map((button) => <div key={button.id} className="flex items-center justify-center gap-2 py-2 text-center text-xs font-semibold text-emerald-600" style={{ color: '#059669' }}><TemplateButtonIcon type={button.type} /><span className="font-semibold text-emerald-600" style={{ color: '#059669' }}>{button.text || buttonLabel[button.type]}</span></div>)}</div> : null}</>
          )}
        </div>
        )}
      </div>
      {showSetupIllustration ? (
        <div className="space-y-4 border-t border-slate-200 bg-white p-4">
          <div>
            <p className="text-xs font-bold text-slate-900">Template này phù hợp cho</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{categoryPreviewGuidance[category].suitableFor}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900">Khu vực có thể tùy chỉnh</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{categoryPreviewGuidance[category].customizable}</p>
          </div>
        </div>
      ) : null}
    </aside>
  );
};

const ReviewRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => <div className="grid gap-1 border-b border-slate-100 py-3 last:border-0 sm:grid-cols-[160px_1fr]"><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="whitespace-pre-wrap wrap-break-word text-sm text-slate-800">{value || '—'}</dd></div>;

const ReviewSections: React.FC<{
  category: WhatsAppTemplateCategory; name: string; language: string; parameterFormat: WhatsAppTemplateParameterFormat; headerFormat: WhatsAppTemplateHeaderFormat; headerText: string; mediaFileName: string; body: string; footer: string; buttons: EditableButton[]; otpType: WhatsAppOtpType; otpButtonText: string; otpExpiration: number; addSecurityRecommendation: boolean;
}> = ({ category, name, language, parameterFormat, headerFormat, headerText, mediaFileName, body, footer, buttons, otpType, otpButtonText, otpExpiration, addSecurityRecommendation }) => (
  <div className="space-y-5">
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div><p className="text-sm font-bold text-amber-900">Sẵn sàng gửi Meta xét duyệt</p><p className="mt-1 text-xs leading-5 text-amber-800">Meta sẽ kiểm tra nội dung, category và định dạng của template. Quá trình xét duyệt có thể mất đến 24 giờ và template chỉ sử dụng được sau khi được phê duyệt.</p></div></div></div>
    <section className={sectionClass}><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Submit for Review</p><h3 className="mt-1 font-bold text-slate-900">Thiết lập template</h3></div><dl><ReviewRow label="Tên" value={<span className="font-mono">{name}</span>} /><ReviewRow label="Category" value={category} /><ReviewRow label="Ngôn ngữ" value={language} />{category !== 'AUTHENTICATION' ? <ReviewRow label="Parameter format" value={parameterFormat} /> : null}</dl></section>
    {category === 'AUTHENTICATION' ? <section className={sectionClass}><h3 className="font-bold text-slate-900">Authentication và OTP</h3><dl><ReviewRow label="Loại OTP" value={otpType} /><ReviewRow label="Nội dung button" value={otpButtonText} /><ReviewRow label="Thời gian hết hạn" value={`${otpExpiration} phút`} /><ReviewRow label="Khuyến nghị bảo mật" value={addSecurityRecommendation ? 'Có' : 'Không'} /></dl></section> : <><section className={sectionClass}><h3 className="font-bold text-slate-900">Nội dung</h3><dl><ReviewRow label="Header" value={headerFormat === 'NONE' ? 'Không có' : headerFormat === 'LOCATION' ? 'LOCATION · Vị trí' : `${headerFormat}${headerFormat === 'TEXT' ? ` · ${headerText}` : ` · ${mediaFileName}`}`} /><ReviewRow label="Body" value={body} /><ReviewRow label="Footer" value={footer} /></dl></section><section className={sectionClass}><h3 className="font-bold text-slate-900">Buttons ({buttons.length})</h3>{buttons.length ? <dl>{buttons.map((button, index) => <ReviewRow key={button.id} label={`Button ${index + 1} · ${button.type}`} value={`${button.text}${button.type === 'URL' ? ` · ${button.url}` : button.type === 'PHONE_NUMBER' ? ` · ${button.phoneNumber}` : ''}`} />)}</dl> : <p className="text-sm text-slate-500">Không có button.</p>}</section></>}
  </div>
);

const VariableSampleRows: React.FC<{
  examples: WhatsAppTemplateExample[];
  onChange: (index: number, value: string) => void;
}> = ({ examples, onChange }) => (
  <div className="space-y-2">
    {examples.map((example, index) => (
      <label
        key={example.name || index}
        className="grid min-w-0 grid-cols-[minmax(84px,35%)_minmax(0,1fr)] gap-2"
      >
        <span className="flex min-h-10 items-center rounded-lg border border-slate-300 bg-slate-100 px-3 text-sm font-semibold text-slate-500">
          {example.name ? `{{${example.name}}}` : `{{${index + 1}}}`}
        </span>
        <input
          required
          value={example.value}
          onChange={(event) => onChange(index, event.target.value)}
          placeholder="Nhập giá trị"
          className={`${inputClass} min-w-0`}
        />
      </label>
    ))}
  </div>
);

const VariableSamples: React.FC<{
  headerExamples: WhatsAppTemplateExample[];
  bodyExamples: WhatsAppTemplateExample[];
  onHeaderChange: (index: number, value: string) => void;
  onBodyChange: (index: number, value: string) => void;
}> = ({ headerExamples, bodyExamples, onHeaderChange, onBodyChange }) => (
  <section className="space-y-4 rounded-xl bg-slate-50 p-4">
    <div>
      <h4 className="text-sm font-bold text-slate-900">Mẫu biến</h4>
      <p className="mt-1 text-xs leading-5 text-slate-600">
        Thêm một giá trị mẫu cho mỗi biến để Meta có thể xem xét mẫu của bạn. Các giá trị mẫu chỉ được dùng cho mục đích kiểm duyệt và sẽ không được gửi đến khách hàng. Hãy nhớ không sử dụng bất kỳ thông tin nào của khách hàng để bảo vệ quyền riêng tư của họ.
      </p>
    </div>
    {headerExamples.length > 0 ? (
      <div className="space-y-2">
        <h5 className="text-xs font-bold text-slate-800">Tiêu đề</h5>
        <VariableSampleRows examples={headerExamples} onChange={onHeaderChange} />
      </div>
    ) : null}
    {bodyExamples.length > 0 ? (
      <div className="space-y-2">
        <h5 className="text-xs font-bold text-slate-800">Nội dung</h5>
        <VariableSampleRows examples={bodyExamples} onChange={onBodyChange} />
      </div>
    ) : null}
  </section>
);

const TemplateCard: React.FC<{ template: WhatsAppApprovedTemplate }> = ({ template }) => {
  const statusClass = STATUS_CLASSES[template.status] || 'border-slate-300 bg-slate-100 text-slate-700';
  const StatusIcon = template.status === 'APPROVED' ? CheckCircle2 : template.status === 'REJECTED' ? XCircle : Clock3;
  const header = template.components.find((component) => component.type?.toUpperCase() === 'HEADER');
  const body = template.components.find((component) => component.type?.toUpperCase() === 'BODY');
  const footer = template.components.find((component) => component.type?.toUpperCase() === 'FOOTER');
  const buttonComponent = template.components.find((component) => component.type?.toUpperCase() === 'BUTTONS');
  const buttons = Array.isArray(buttonComponent?.buttons) ? buttonComponent.buttons as Array<{ type?: string; text?: string; url?: string; phone_number?: string; otp_type?: string }> : [];
  const rejectionReason = template.status === 'REJECTED' && template.rejected_reason && template.rejected_reason !== 'NONE' ? template.rejected_reason : null;
  const qualityScore = template.quality_score?.score && template.quality_score.score !== 'UNKNOWN' ? template.quality_score.score : null;
  const isMetaSample = template.name === 'hello_world';

  return (
    <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><h3 className="truncate font-mono text-sm font-bold text-slate-900">{template.name}</h3>{isMetaSample ? <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">Mẫu của Meta</span> : null}</div><p className="mt-1 text-xs text-slate-500">{template.language} · {template.category} · {template.parameter_format || 'POSITIONAL'}</p></div><span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusClass}`}><StatusIcon className="h-3.5 w-3.5" />{template.status}</span></div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">{header ? <div className="border-b border-slate-200 px-3 py-2 text-xs font-bold text-slate-800">{header.format && header.format !== 'TEXT' ? `[${header.format}]` : header.text}</div> : null}{body?.text ? <p className="whitespace-pre-wrap px-3 py-3 text-xs leading-relaxed text-slate-700">{body.text}</p> : template.category === 'AUTHENTICATION' ? <p className="px-3 py-3 text-xs text-slate-700">Nội dung mã xác thực do Meta tạo tự động.</p> : null}{footer?.text ? <p className="border-t border-slate-200 px-3 py-2 text-[11px] text-slate-500">{footer.text}</p> : null}{buttons.length > 0 ? <div className="grid gap-1 border-t border-slate-200 p-2">{buttons.map((button, index) => <div key={index} className="flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-center text-xs font-semibold text-emerald-600" style={{ color: '#059669' }}><TemplateButtonIcon type={(button.type === 'COPY_CODE' || button.otp_type === 'COPY_CODE' ? 'COPY_CODE' : button.type || 'QUICK_REPLY') as WhatsAppTemplateButtonType} /><span className="text-emerald-600 font-semibold" style={{ color: '#059669' }}>{button.text || button.otp_type || buttonLabel[button.type as WhatsAppTemplateButtonType] || button.type}</span></div>)}</div> : null}</div>
      {rejectionReason ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"><strong>Lý do từ chối:</strong> {rejectionReason}</div> : null}
      {qualityScore ? <p className="text-[11px] font-medium text-slate-500">Quality score: {qualityScore}</p> : null}
    </article>
  );
};
