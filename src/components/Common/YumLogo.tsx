import React from 'react';

interface YumLogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const YumLogo: React.FC<YumLogoProps> = ({ className = '', showText = false, size = 'md' }) => {
  const heightClass = size === 'sm' ? 'h-8' : size === 'lg' ? 'h-12 sm:h-14' : 'h-10';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Official Uploaded PNG Logo */}
      <img
        src="/logo.png"
        alt="YumNetwork CRM"
        className={`${heightClass} w-auto object-contain shrink-0`}
      />

      {showText && (
        <span className="font-extrabold tracking-tight text-slate-900 flex items-center gap-1.5 text-lg sm:text-xl">
          <span className="text-red-600 font-black">YumNetwork</span>
          <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">CRM</span>
        </span>
      )}
    </div>
  );
};
