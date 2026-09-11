import React, { useState, useMemo } from 'react';
import { Translation } from '@speakbetter/types';
import { Languages, ChevronDown, ChevronUp, Loader2, RotateCcw } from 'lucide-react';

interface MessageTranslationProps {
  translations: Translation[];
  originalContent: string;
  onTranslate: (languageCode: string) => Promise<void> | void;
  isOwn?: boolean;
}

interface LanguageOption {
  code: string;
  name: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'hi', name: 'Hindi' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ar', name: 'Arabic' },
  { code: 'it', name: 'Italian' },
];

export const MessageTranslation: React.FC<MessageTranslationProps> = ({
  translations = [],
  originalContent,
  onTranslate,
  isOwn = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [selectedLang, setSelectedLang] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  // Map for O(1) lookup of language display names
  const languageMap = useMemo(() => {
    return new Map(LANGUAGES.map((lang) => [lang.code, lang.name]));
  }, []);

  // Find translation match either from prop array or direct language key
  const activeTranslation = useMemo(() => {
    if (!selectedLang) return null;
    return translations.find(
      (t) => t.language?.toLowerCase() === selectedLang.toLowerCase()
    );
  }, [selectedLang, translations]);

  const handleSelectLanguage = async (code: string) => {
    if (!code) return;
    setSelectedLang(code);
    setIsTranslating(true);

    try {
      await onTranslate(code);
    } catch (error) {
      // Allow fallback / reset on failure
    } finally {
      setIsTranslating(false);
    }
  };

  const handleResetTranslation = () => {
    setSelectedLang(null);
  };

  const primaryLanguages = LANGUAGES.slice(0, 6);
  const secondaryLanguages = LANGUAGES.slice(6);

  return (
    <div className="mt-1 text-xs select-none">
      {/* Trigger Toggle Button */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className={`inline-flex items-center gap-1 font-medium transition-colors py-0.5 rounded focus:outline-none ${
          isOwn
            ? 'text-white/80 hover:text-white focus:ring-1 focus:ring-white/40'
            : 'text-gray-500 hover:text-gray-800 focus:ring-1 focus:ring-gray-300'
        }`}
      >
        <Languages className="w-3.5 h-3.5" />
        <span>{selectedLang ? 'Translated' : 'Translate'}</span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {/* Expanded Actions Panel */}
      {expanded && (
        <div className="mt-1.5 space-y-2">
          {/* Active Translation Output Box */}
          {selectedLang && (
            <div
              className={`p-2.5 rounded-lg border text-sm transition-all ${
                isOwn
                  ? 'bg-blue-600/30 border-blue-400/30 text-white'
                  : 'bg-slate-50 border-gray-200 text-gray-800'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] opacity-75 mb-1">
                <span>
                  Translated to{' '}
                  <strong className="font-semibold">
                    {languageMap.get(selectedLang) || selectedLang.toUpperCase()}
                  </strong>
                </span>

                <button
                  type="button"
                  onClick={handleResetTranslation}
                  className={`inline-flex items-center gap-1 hover:underline ${
                    isOwn ? 'text-white/90' : 'text-gray-600'
                  }`}
                >
                  <RotateCcw className="w-3 h-3" />
                  Original
                </button>
              </div>

              {isTranslating ? (
                <div className="flex items-center gap-2 py-1 text-xs opacity-80">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Translating...</span>
                </div>
              ) : activeTranslation ? (
                <p className="leading-relaxed whitespace-pre-wrap">
                  {activeTranslation.translatedContent}
                </p>
              ) : (
                <p className="text-xs italic opacity-80">
                  Unable to translate content to this language.
                </p>
              )}
            </div>
          )}

          {/* Language Selection Quick Pills */}
          {!selectedLang && (
            <div className="flex flex-wrap items-center gap-1.5">
              {primaryLanguages.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleSelectLanguage(lang.code)}
                  className={`px-2 py-1 rounded-md font-medium text-xs transition-all ${
                    isOwn
                      ? 'bg-white/15 hover:bg-white/25 text-white active:bg-white/30'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700 active:bg-gray-300'
                  }`}
                >
                  {lang.name}
                </button>
              ))}

              {/* Extended Languages Select Dropdown */}
              {secondaryLanguages.length > 0 && (
                <div className="relative inline-block">
                  <select
                    value=""
                    onChange={(e) => handleSelectLanguage(e.target.value)}
                    className={`appearance-none px-2 py-1 pr-5 rounded-md font-medium text-xs cursor-pointer focus:outline-none transition-all ${
                      isOwn
                        ? 'bg-white/15 hover:bg-white/25 text-white border-none [&>option]:text-gray-900'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-none'
                    }`}
                  >
                    <option value="" disabled>
                      More...
                    </option>
                    {secondaryLanguages.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};