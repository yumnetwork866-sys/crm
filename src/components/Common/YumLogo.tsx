import React from 'react';

interface YumLogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const YumLogo: React.FC<YumLogoProps> = ({ className = '', showText = true, size = 'md' }) => {
  const heightClass = size === 'sm' ? 'h-8' : size === 'lg' ? 'h-14' : 'h-10';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* SVG Icon Logo */}
      <div className={`${heightClass} aspect-[4/1.6] flex items-center justify-center filter drop-shadow-sm`}>
        <svg viewBox="0 0 400 160" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <g fill="#d31017">
            {/* Y */}
            <path d="M 20 20 L 50 70 L 50 110 L 70 110 L 70 70 L 100 20 L 78 20 L 60 55 L 42 20 Z" />
            {/* U */}
            <path d="M 115 20 L 135 20 L 135 85 C 135 98 145 102 155 102 C 165 102 175 98 175 85 L 175 20 L 195 20 L 195 85 C 195 108 178 118 155 118 C 132 118 115 108 115 85 Z" />
            {/* M */}
            <path d="M 210 20 L 230 20 L 255 75 L 280 20 L 300 20 L 300 110 L 280 110 L 280 50 L 262 95 L 248 95 L 230 50 L 230 110 L 210 110 Z" />
            
            {/* N */}
            <path d="M 20 128 L 30 128 L 45 148 L 45 128 L 54 128 L 54 156 L 44 156 L 29 136 L 29 156 L 20 156 Z" />
            {/* E (3 horizontal bars) */}
            <path d="M 64 128 L 88 128 L 88 134 L 64 134 Z M 64 139 L 84 139 L 84 145 L 64 145 Z M 64 150 L 88 150 L 88 156 L 64 156 Z" />
            {/* T */}
            <path d="M 95 128 L 123 128 L 123 134 L 113 134 L 113 156 L 105 156 L 105 134 L 95 134 Z" />
            {/* Infinity loop W+O */}
            <path d="M 132 142 C 132 134 139 128 147 128 C 153 128 158 132 163 138 C 168 132 173 128 179 128 C 187 128 194 134 194 142 C 194 150 187 156 179 156 C 173 156 168 152 163 146 C 158 152 153 156 147 156 C 139 156 132 150 132 142 Z M 147 150 C 152 150 156 146 159 142 C 156 138 152 134 147 134 C 142 134 138 138 138 142 C 138 146 142 150 147 150 Z M 179 150 C 184 150 188 146 188 142 C 188 138 184 134 179 134 C 174 134 170 138 167 142 C 170 146 174 150 179 150 Z" />
            {/* R */}
            <path d="M 203 128 L 221 128 C 228 128 233 132 233 137 C 233 141 229 144 224 145 L 234 156 L 223 156 L 214 146 L 212 146 L 212 156 L 203 156 Z M 212 134 L 212 140 L 220 140 C 223 140 225 139 225 137 C 225 135 223 134 220 134 Z" />
            {/* K */}
            <path d="M 241 128 L 250 128 L 250 139 L 262 128 L 273 128 L 259 141 L 274 156 L 263 156 L 250 143 L 250 156 L 241 156 Z" />
          </g>
          {/* Badge CRM */}
          <rect x="290" y="124" width="65" height="32" rx="6" fill="#d31017" />
          <text x="322" y="146" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="16" text-anchor="middle">CRM</text>
        </svg>
      </div>

      {showText && (
        <span className="font-extrabold tracking-tight text-white flex items-center gap-1.5 text-lg sm:text-xl">
          <span className="text-red-500 font-black">YumNetwork</span>
          <span className="bg-red-600/20 text-red-400 border border-red-500/30 text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">CRM</span>
        </span>
      )}
    </div>
  );
};
