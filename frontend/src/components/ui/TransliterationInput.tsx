import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { Input } from './input';

interface TransliterationInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onTransliterate: (hindiText: string) => void;
}

export function TransliterationInput({ onTransliterate, value, onChange, onKeyDown, ...props }: TransliterationInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Handle outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSuggestions = async (text: string) => {
    if (!text.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    // Only fetch if last char is english to save calls, or just fetch all
    const words = text.split(' ');
    const lastWord = words[words.length - 1];

    if (!lastWord || !/^[a-zA-Z]+$/.test(lastWord)) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    try {
      const response = await fetch(`https://inputtools.google.com/request?text=${lastWord}&itc=hi-t-i0-und&num=5`);
      const data = await response.json();
      if (data[0] === 'SUCCESS') {
        const transliterations = data[1][0][1];
        setSuggestions(transliterations);
        setShowDropdown(true);
        setActiveSuggestion(0);
      }
    } catch (error) {
      console.error("Transliteration error:", error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) onChange(e);
    const val = e.target.value;
    fetchSuggestions(val);
  };

  const handleSelectSuggestion = (suggestion: string) => {
    const text = String(value || "");
    const words = text.split(' ');
    words[words.length - 1] = suggestion; // replace last typed english word with hindi
    const newText = words.join(' ') + ' ';
    onTransliterate(newText);
    setSuggestions([]);
    setShowDropdown(false);
    
    // Create a synthetic event to trigger onChange of parent if needed
    if (onChange) {
      const e = {
        target: { value: newText }
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(e);
    }
  };

  const handleKeyDownLocal = (e: KeyboardEvent<HTMLInputElement>) => {
    if (showDropdown && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestion((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestion((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSelectSuggestion(suggestions[activeSuggestion]);
        return; // Don't propagate enter if selecting suggestion
      } else if (e.key === 'Escape') {
        setShowDropdown(false);
      } else if (e.key === ' ') {
        // Space bar auto selects the top suggestion
        if (suggestions.length > 0) {
          e.preventDefault();
          handleSelectSuggestion(suggestions[0]);
          return;
        }
      }
    }
    
    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <Input 
        {...props} 
        value={value} 
        onChange={handleInputChange} 
        onKeyDown={handleKeyDownLocal}
        autoComplete="off"
      />
      
      {showDropdown && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full sm:w-64 bg-white border border-slate-300 rounded shadow-lg overflow-hidden font-sans text-base">
          {suggestions.map((suggestion, index) => (
            <li
              key={index}
              onClick={() => handleSelectSuggestion(suggestion)}
              className={`px-3 py-2 cursor-pointer flex items-center gap-2 ${
                index === activeSuggestion ? 'bg-slate-100 font-bold' : 'hover:bg-slate-50'
              }`}
            >
              <span className="text-slate-400 text-sm">{index + 1}.</span>
              <span className="text-slate-800">{suggestion}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
