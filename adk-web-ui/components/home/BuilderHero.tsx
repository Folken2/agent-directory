'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { BUILDER_EXAMPLE_PROMPTS, MAX_BUILDER_PROMPT_LENGTH, builderChatHref } from '@/lib/builder';

const MAX_HEIGHT = 200;

function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(MAX_HEIGHT, el.scrollHeight)}px`;
  el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden';
}

export default function BuilderHero() {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = value.trim().length > 0 && !submitting;

  const submit = () => {
    if (!canSubmit) return;
    setSubmitting(true);
    router.push(builderChatHref(value));
  };

  const fill = (prompt: string) => {
    setValue(prompt);
    // Wait for the controlled value to land before measuring.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      autoGrow(el);
      el?.focus();
      el?.setSelectionRange(prompt.length, prompt.length);
    });
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-end gap-2 rounded-[var(--md-shape-xl)] border border-md-outline/70 bg-md-surface p-2 pl-6 shadow-sm transition-all duration-200 hover:border-md-outline focus-within:border-md-primary/70 focus-within:shadow-md focus-within:ring-2 focus-within:ring-md-primary/25"
      >
        <label htmlFor="builder-prompt" className="sr-only">
          Describe the agent you want to build
        </label>
        <textarea
          id="builder-prompt"
          ref={textareaRef}
          rows={1}
          value={value}
          maxLength={MAX_BUILDER_PROMPT_LENGTH}
          onChange={(e) => {
            setValue(e.target.value);
            autoGrow(e.target);
          }}
          onCompositionStart={() => (isComposingRef.current = true)}
          onCompositionEnd={() => (isComposingRef.current = false)}
          onKeyDown={(e) => {
            if (isComposingRef.current) return;
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Describe your agent…"
          className="max-h-[200px] min-h-12 flex-1 resize-none overflow-hidden bg-transparent py-3 text-body-large text-md-on-surface placeholder:text-md-on-surface-variant focus:outline-none"
        />
        <Button type="submit" size="icon" disabled={!canSubmit} aria-label="Start building" className="mb-0.5 shrink-0 bg-md-primary text-md-on-primary hover:bg-md-primary/92 disabled:bg-md-on-surface/12 disabled:text-md-on-surface-variant disabled:opacity-100">
          <ArrowUp />
        </Button>
      </form>

      <div className="mt-5 flex flex-wrap justify-center gap-2" aria-label="Example ideas">
        {BUILDER_EXAMPLE_PROMPTS.map((example) => (
          <Chip
            key={example.label}
            variant="assist"
            onClick={() => fill(example.prompt)}
            className="h-9 rounded-full border-md-outline/60 bg-md-surface px-4 font-normal text-md-on-surface/90 hover:border-md-primary/40 hover:bg-md-surface"
          >
            {example.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}
