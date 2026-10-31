import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, X, Plus, Check } from 'lucide-react';

export interface SearchableComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  createLabel?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const SearchableCombobox: React.FC<SearchableComboboxProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Search or enter new...',
  createLabel = 'Create new',
  id,
  disabled = false,
  required = false,
  className = '',
  style,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync internal input value with external value prop
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Handle click outside to close dropdown and commit typed value
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        const trimmed = inputValue.trim();
        if (trimmed !== value) {
          onChange(trimmed);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [inputValue, value, onChange]);

  // Filter options based on user input
  const filteredOptions = useMemo(() => {
    if (!inputValue.trim()) {
      return options;
    }
    const query = inputValue.toLowerCase().trim();
    return options.filter((opt) => opt.toLowerCase().includes(query));
  }, [options, inputValue]);

  // Check if current input matches an existing option exactly
  const isExactMatch = useMemo(() => {
    const trimmed = inputValue.trim().toLowerCase();
    if (!trimmed) return true;
    return options.some((opt) => opt.toLowerCase() === trimmed);
  }, [options, inputValue]);

  const handleSelectOption = (opt: string) => {
    setInputValue(opt);
    onChange(opt);
    setIsOpen(false);
  };

  const handleCreateNew = () => {
    const trimmed = inputValue.trim();
    if (trimmed) {
      setInputValue(trimmed);
      onChange(trimmed);
    }
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setInputValue('');
    onChange('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
    setIsOpen(true);
  };

  return (
    <div
      ref={containerRef}
      className={`searchable-combobox-container ${className}`}
      style={{ position: 'relative', width: '100%', ...style }}
    >
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          ref={inputRef}
          id={id}
          type="text"
          className="form-input"
          style={{
            width: '100%',
            paddingRight: inputValue ? '3.8rem' : '2.2rem',
            cursor: 'text',
          }}
          placeholder={placeholder}
          value={inputValue}
          disabled={disabled}
          required={required}
          autoComplete="off"
          onChange={(e) => {
            setInputValue(e.target.value);
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const trimmed = inputValue.trim();
              if (trimmed) {
                onChange(trimmed);
              }
              setIsOpen(false);
            } else if (e.key === 'Escape') {
              setIsOpen(false);
            } else if (e.key === 'ArrowDown' && !isOpen) {
              setIsOpen(true);
            }
          }}
        />

        {/* Clear and Dropdown Toggle Controls */}
        <div
          style={{
            position: 'absolute',
            right: '0.45rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.2rem',
          }}
        >
          {inputValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              style={{
                background: 'none',
                border: 'none',
                padding: '0.2rem',
                cursor: 'pointer',
                color: 'var(--gray-400)',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '50%',
              }}
              title="Clear input"
            >
              <X size={14} />
            </button>
          )}

          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (!disabled) {
                setIsOpen((prev) => !prev);
                if (!isOpen && inputRef.current) {
                  inputRef.current.focus();
                }
              }
            }}
            style={{
              background: 'none',
              border: 'none',
              padding: '0.25rem',
              cursor: disabled ? 'default' : 'pointer',
              color: 'var(--gray-500)',
              display: 'flex',
              alignItems: 'center',
              borderRadius: 'var(--radius-sm)',
            }}
            title="Toggle dropdown"
          >
            <ChevronDown
              size={15}
              style={{
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s ease',
              }}
            />
          </button>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            backgroundColor: '#ffffff',
            border: '1px solid var(--gray-300)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--card-shadow-lg)',
            zIndex: 1000,
            maxHeight: '220px',
            overflowY: 'auto',
          }}
        >
          {/* Create New Option when input doesn't match existing */}
          {inputValue.trim() && !isExactMatch && (
            <div
              onClick={handleCreateNew}
              style={{
                padding: '0.55rem 0.85rem',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary-dark)',
                fontSize: '0.85rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                cursor: 'pointer',
                borderBottom: filteredOptions.length > 0 ? '1px solid var(--gray-200)' : 'none',
              }}
            >
              <Plus size={14} style={{ color: 'var(--primary)' }} />
              <span>
                {createLabel}: <strong>"{inputValue.trim()}"</strong>
              </span>
            </div>
          )}

          {/* Stored Options List */}
          {filteredOptions.length > 0 ? (
            <div>
              {filteredOptions.map((opt) => {
                const isSelected = opt.toLowerCase() === (value || '').toLowerCase();
                return (
                  <div
                    key={opt}
                    onClick={() => handleSelectOption(opt)}
                    style={{
                      padding: '0.5rem 0.85rem',
                      fontSize: '0.85rem',
                      color: 'var(--gray-800)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: isSelected ? 'var(--gray-100)' : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isSelected
                        ? 'var(--gray-200)'
                        : 'var(--gray-50)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = isSelected
                        ? 'var(--gray-100)'
                        : 'transparent';
                    }}
                  >
                    <span>{opt}</span>
                    {isSelected && <Check size={14} style={{ color: 'var(--primary)' }} />}
                  </div>
                );
              })}
            </div>
          ) : !inputValue.trim() ? (
            <div
              style={{
                padding: '0.65rem 0.85rem',
                fontSize: '0.8rem',
                color: 'var(--gray-500)',
                fontStyle: 'italic',
                textAlign: 'center',
              }}
            >
              No stored values yet — type to create one
            </div>
          ) : isExactMatch ? null : (
            <div
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.75rem',
                color: 'var(--gray-500)',
                textAlign: 'center',
              }}
            >
              Press Enter or click above to create
            </div>
          )}
        </div>
      )}
    </div>
  );
};

