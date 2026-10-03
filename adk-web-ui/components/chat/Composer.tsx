'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Paperclip, X, ArrowUp, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NOT_AFFILIATED_NOTICE } from '@/lib/site';

const MAX_HEIGHT = 220;

function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  const newHeight = Math.min(MAX_HEIGHT, el.scrollHeight);
  el.style.height = `${newHeight}px`;
  const shouldScroll = el.scrollHeight > MAX_HEIGHT;
  el.style.overflowY = shouldScroll ? 'auto' : 'hidden';
}

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  attachments: File[];
  onAttachFiles: (files: File[]) => void;
  onRemoveAttachment: (index: number) => void;
  /** Display name of the selected agent; null disables the composer. */
  agentName: string | null;
  busy: boolean; // any of: isLoading, isStreaming, isInitializing
  initialPrompt?: string | null;
}

export default function Composer({
  value,
  onChange,
  onSend,
  onStop,
  attachments,
  onAttachFiles,
  onRemoveAttachment,
  agentName,
  busy,
  initialPrompt,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isComposingRef = useRef(false);
  const lastInitialPromptRef = useRef<string | null>(null);
  const [focused, setFocused] = useState(false);

  const disabled = !agentName || busy;
  const canSend = (value.trim().length > 0 || attachments.length > 0) && !disabled;

  useEffect(() => {
    autoGrow(textareaRef.current);
  }, [value]);

  useEffect(() => {
    if (!busy && textareaRef.current) {
      textareaRef.current.focus();
      autoGrow(textareaRef.current);
    }
  }, [busy]);

  useEffect(() => {
    if (!initialPrompt) {
      lastInitialPromptRef.current = null;
      return;
    }
    if (initialPrompt === lastInitialPromptRef.current) return;
    lastInitialPromptRef.current = initialPrompt;
    onChange(initialPrompt);
    setTimeout(() => {
      autoGrow(textareaRef.current);
      textareaRef.current?.focus();
    }, 0);
  }, [initialPrompt, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isComposingRef.current) return;
    const submitWithModifier = (e.metaKey || e.ctrlKey) && e.key === 'Enter';
    const submitPlain = e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey;
    if (submitWithModifier || submitPlain) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) onAttachFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="px-4 pb-4 pt-2">
      <div className="pointer-events-none absolute inset-x-0 -top-4 h-6 bg-linear-to-t from-md-surface-container-low to-transparent" />
      <div className="mx-auto max-w-3xl">
        <div
          className={cn(
            'group rounded-[var(--md-shape-xl)] border bg-md-surface shadow-sm transition-all duration-200',
            focused
              ? 'border-md-primary/70 shadow-md ring-2 ring-md-primary/25'
              : 'border-md-outline/70 hover:border-md-outline',
            disabled && 'opacity-95',
          )}
        >
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 pt-3">
              {attachments.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-2 px-3 py-1.5 bg-md-surface-container rounded-full text-xs font-medium"
                >
                  <Paperclip className="w-3 h-3 text-md-on-surface-variant" />
                  <span className="truncate max-w-[180px]">{file.name}</span>
                  <button
                    onClick={() => onRemoveAttachment(index)}
                    className="text-md-on-surface-variant hover:text-md-on-surface transition-colors"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              autoGrow(e.target);
            }}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={() => {
              isComposingRef.current = false;
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={agentName ? `Message ${agentName}…` : 'Select an agent first'}
            disabled={disabled}
            rows={1}
            className="block w-full resize-none bg-transparent border-0 px-5 pt-4 pb-1 text-sm leading-6 placeholder:text-md-on-surface-variant/80 focus:outline-none focus:ring-0 disabled:cursor-not-allowed"
            style={{ minHeight: '52px', maxHeight: `${MAX_HEIGHT}px` }}
          />

          <div className="flex items-center justify-between gap-2 px-3 pb-2.5 pt-1">
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFiles}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="inline-flex items-center justify-center h-9 w-9 rounded-full text-md-on-surface-variant hover:text-md-on-surface hover:bg-md-surface-container/70 transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
                title="Attach files"
                aria-label="Attach files"
              >
                <Paperclip className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'hidden sm:inline text-[11px] text-md-on-surface-variant/70 transition-opacity',
                  focused || value.length > 0 ? 'opacity-100' : 'opacity-0',
                )}
              >
                <kbd className="font-mono">Enter</kbd> to send · <kbd className="font-mono">Shift+Enter</kbd> for new line
              </span>
              {busy && onStop ? (
                <button
                  onClick={onStop}
                  className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-md-on-surface text-md-surface-container-low hover:opacity-90 shadow-sm active:scale-95 transition-all duration-150"
                  title="Stop generating"
                  aria-label="Stop generating"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              ) : (
                <button
                  onClick={onSend}
                  disabled={!canSend}
                  className={cn(
                    'inline-flex items-center justify-center h-9 w-9 rounded-full transition-all duration-150',
                    canSend
                      ? 'bg-md-primary text-md-on-primary hover:opacity-90 shadow-sm active:scale-95'
                      : 'bg-md-surface-container text-md-on-surface-variant cursor-not-allowed',
                  )}
                  title="Send message"
                  aria-label="Send message"
                >
                  <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-md-on-surface-variant mt-3">
          AI can make mistakes. Please verify important information.
        </p>
        <p className="mx-auto mt-1 max-w-2xl text-center text-[11px] leading-snug text-md-on-surface-variant/80">
          {NOT_AFFILIATED_NOTICE}
        </p>
      </div>
    </div>
  );
}
