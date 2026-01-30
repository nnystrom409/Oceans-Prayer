"use client";

import { useRef, useEffect } from "react";

interface CountryPopupProps {
  countryName: string;
  position: { x: number; y: number };
  onClose: () => void;
}

export function CountryPopup({ countryName, position, onClose }: CountryPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Delay adding listener to prevent immediate close
    const timeout = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={popupRef}
      className="fixed z-50 pointer-events-auto"
      style={{
        left: position.x,
        top: position.y,
        transform: "translate(-50%, -100%)",
      }}
    >
      <div className="relative">
        {/* Popup content */}
        <div
          className="px-4 py-2 rounded-xl shadow-lg backdrop-blur-md
                     bg-white/80 border border-white/50
                     text-gray-800 font-medium text-sm
                     animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          {countryName}
        </div>

        {/* Arrow pointer */}
        <div
          className="absolute left-1/2 -translate-x-1/2 top-full
                     w-0 h-0 border-l-[8px] border-r-[8px] border-t-[8px]
                     border-l-transparent border-r-transparent border-t-white/80"
        />
      </div>
    </div>
  );
}
