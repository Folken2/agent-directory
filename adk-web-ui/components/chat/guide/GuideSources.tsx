'use client';

type Props = {
  sources: { title: string; url: string }[];
};

export function GuideSources({ sources }: Props) {
  return (
    <div className="border-t border-border/60 pt-3">
      <h3 className="text-xs font-medium text-muted-foreground mb-1.5">Sources</h3>
      <ul className="space-y-1">
        {sources.map((source) => (
          <li key={source.url} className="text-xs">
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground/70 underline-offset-2 hover:underline"
            >
              {source.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
