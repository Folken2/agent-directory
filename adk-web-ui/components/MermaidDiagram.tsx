'use client';

import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidDiagramProps {
  code: string;
  id?: string;
  isStreaming?: boolean; // If true, only render when code appears complete
}

// Helper function to validate if Mermaid code appears complete
function isMermaidCodeComplete(code: string): boolean {
  if (!code || !code.trim()) return false;
  
  const trimmed = code.trim();
  
  // Check if it starts with a valid Mermaid diagram type
  const validStarts = [
    'graph', 'flowchart', 'sequenceDiagram', 'classDiagram',
    'stateDiagram', 'erDiagram', 'journey', 'gantt',
    'pie', 'gitgraph', 'mindmap', 'timeline', 'C4Context',
    'C4Container', 'C4Component', 'C4Dynamic', 'C4Deployment'
  ];
  
  const startsWithValid = validStarts.some(start => 
    trimmed.toLowerCase().startsWith(start.toLowerCase())
  );
  
  if (!startsWithValid) return false;
  
  // Check for balanced brackets (basic validation)
  const openBrackets = (trimmed.match(/\[/g) || []).length;
  const closeBrackets = (trimmed.match(/\]/g) || []).length;
  const openParens = (trimmed.match(/\(/g) || []).length;
  const closeParens = (trimmed.match(/\)/g) || []).length;
  const openBraces = (trimmed.match(/\{/g) || []).length;
  const closeBraces = (trimmed.match(/\}/g) || []).length;
  
  // Allow some imbalance during streaming, but not too much
  const bracketBalance = Math.abs(openBrackets - closeBrackets);
  const parenBalance = Math.abs(openParens - closeParens);
  const braceBalance = Math.abs(openBraces - closeBraces);
  
  // If brackets are severely unbalanced, code is likely incomplete
  if (bracketBalance > 2 || parenBalance > 2 || braceBalance > 2) {
    return false;
  }
  
  // Check if code ends with a complete statement (not mid-arrow or mid-label)
  const lastLine = trimmed.split('\n').filter(l => l.trim()).pop() || '';
  const trimmedLastLine = lastLine.trim();
  
  // If last line ends with incomplete arrow or unclosed bracket, likely incomplete
  if (trimmedLastLine.match(/--?>?\s*$/) && trimmedLastLine.length < 10) {
    return false;
  }
  
  // Minimum length check - very short code is likely incomplete
  if (trimmed.length < 20) {
    return false;
  }
  
  return true;
}

// Helper function to sanitize Mermaid code
function sanitizeMermaidCode(code: string): string {
  if (!code) return '';
  
  // Remove markdown code fences if present
  let cleaned = code
    .replace(/^```mermaid\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/gm, '') // Remove closing fences from any line
    .trim();
  
  // Remove any invisible/zero-width characters that might cause parsing issues
  cleaned = cleaned
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces
    .replace(/\u00A0/g, ' ') // Replace non-breaking spaces with regular spaces
    .trim();
  
  // Split into lines and clean each line
  let lines = cleaned.split('\n').map(line => line.trimEnd());
  
  // Remove empty lines at start and end
  while (lines.length > 0 && !lines[0].trim()) lines.shift();
  while (lines.length > 0 && !lines[lines.length - 1].trim()) lines.pop();
  
  // Fix broken connections and node labels
  // Handle cases where:
  // 1. A line ends with an arrow but next line doesn't start with a node
  // 2. A line has an unclosed bracket (node label split across lines)
  const fixedLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trim();
    
    // Check for unclosed brackets - node labels split across lines
    // Count opening and closing brackets of different types
    const openSquare = (trimmed.match(/\[/g) || []).length;
    const closeSquare = (trimmed.match(/\]/g) || []).length;
    const openParen = (trimmed.match(/\(/g) || []).length;
    const closeParen = (trimmed.match(/\)/g) || []).length;
    const openCurly = (trimmed.match(/\{/g) || []).length;
    const closeCurly = (trimmed.match(/\}/g) || []).length;
    
    // If there are unclosed brackets, merge with following lines until balanced
    let hasUnclosedBrackets = 
      openSquare > closeSquare || 
      openParen > closeParen || 
      openCurly > closeCurly;
    
    while (hasUnclosedBrackets && i + 1 < lines.length) {
      i++;
      const nextLine = lines[i].trim();
      line = line + ' ' + nextLine;
      
      // Recount brackets
      const totalOpenSquare = (line.match(/\[/g) || []).length;
      const totalCloseSquare = (line.match(/\]/g) || []).length;
      const totalOpenParen = (line.match(/\(/g) || []).length;
      const totalCloseParen = (line.match(/\)/g) || []).length;
      const totalOpenCurly = (line.match(/\{/g) || []).length;
      const totalCloseCurly = (line.match(/\}/g) || []).length;
      
      hasUnclosedBrackets = 
        totalOpenSquare > totalCloseSquare || 
        totalOpenParen > totalCloseParen || 
        totalOpenCurly > totalCloseCurly;
    }
    
    const updatedTrimmed = line.trim();
    
    // If line ends with an arrow (--> or other arrow types)
    if (updatedTrimmed.match(/--?>?\s*$/)) {
      // Check if next line exists and doesn't start with a node identifier
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        // If next line doesn't start with a node (letter/digit followed by bracket/paren/brace or just text)
        // and current line ends with arrow, merge them
        if (nextLine && !nextLine.match(/^[A-Za-z0-9_]+[\[\(\{]/) && !nextLine.match(/^[A-Za-z0-9_]+\s/)) {
          fixedLines.push(line + ' ' + nextLine);
          i++; // Skip next line as we merged it
          continue;
        }
      }
    }
    
    fixedLines.push(line);
  }
  
  lines = fixedLines;
  
  // Find minimum indentation (excluding empty lines)
  const nonEmptyLines = lines.filter(line => line.trim().length > 0);
  
  if (nonEmptyLines.length > 0) {
    const minIndent = Math.min(
      ...nonEmptyLines.map(line => {
        const match = line.match(/^(\s*)/);
        return match ? match[1].length : 0;
      })
    );
    
    // Remove common indentation
    if (minIndent > 0) {
      cleaned = lines
        .map(line => {
          if (!line.trim()) return ''; // Remove empty lines
          return line.startsWith(' '.repeat(minIndent)) ? line.slice(minIndent) : line;
        })
        .filter(line => line.trim().length > 0) // Remove empty lines after dedent
        .join('\n');
    } else {
      cleaned = lines.filter(line => line.trim().length > 0).join('\n');
    }
  } else {
    cleaned = lines.filter(line => line.trim().length > 0).join('\n');
  }
  
  // Final cleanup: ensure no double newlines and normalize spacing
  cleaned = cleaned
    .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
    .replace(/[ \t]+/g, ' ') // Normalize multiple spaces/tabs to single space
    .trim();
  
  return cleaned;
}

export default function MermaidDiagram({ code, id, isStreaming = false }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const diagramId = id || `mermaid-${Math.random().toString(36).substr(2, 9)}`;

  useEffect(() => {
    // While streaming we intentionally DO NOT attempt to parse/render.
    // Mermaid frequently fails on partial code and can spam the console with parse errors.
    if (isStreaming) {
      setError(null);
      setIsRendering(true);
      return;
    }

    if (!containerRef.current || !code.trim()) {
      setIsRendering(false);
      return;
    }

    // Sanitize the code before validation/render
    const sanitizedCode = sanitizeMermaidCode(code);
    
    if (!sanitizedCode) {
      setError('Empty Mermaid diagram code');
      setIsRendering(false);
      return;
    }

    let cancelled = false;

    const validateAndRender = async (): Promise<void> => {
      setIsRendering(true);
      setError(null);

      // Detect dark mode
      const isDarkMode =
        document.documentElement.classList.contains('dark') ||
        window.matchMedia('(prefers-color-scheme: dark)').matches;

      // Initialize mermaid if not already initialized
      mermaid.initialize({
        startOnLoad: false,
        theme: isDarkMode ? 'dark' : 'default',
        securityLevel: 'loose',
        fontFamily: 'inherit',
      });

      // Clear previous content
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }

      // Validate syntax BEFORE rendering.
      // Note: in newer mermaid versions, parse() may be async (Promise). Handle both sync/async.
      try {
        const parseResult = mermaid.parse(sanitizedCode) as unknown;
        if (
          typeof parseResult === 'object' &&
          parseResult !== null &&
          'then' in parseResult &&
          typeof (parseResult as { then?: unknown }).then === 'function'
        ) {
          await (parseResult as Promise<unknown>);
        }
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : typeof err === 'string'
              ? err
              : 'Invalid Mermaid syntax';
        setError(message);
        setIsRendering(false);
        return;
      }

      try {
        const result = await mermaid.render(diagramId, sanitizedCode);
        if (cancelled) return;
        if (containerRef.current) {
          containerRef.current.innerHTML = result.svg;
        }
        setIsRendering(false);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : typeof err === 'string'
              ? err
              : 'Failed to render diagram';
        setError(message);
        setIsRendering(false);
      }
    };

    void validateAndRender();

    return () => {
      cancelled = true;
    };
  }, [code, diagramId, isStreaming]);

  if (error) {
    return (
      <div className="my-4 p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-950/20">
        <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-2">
          Diagram rendering error
        </p>
        <p className="text-xs text-red-500 dark:text-red-500/80">{error}</p>
        <details className="mt-2">
          <summary className="text-xs text-red-500 dark:text-red-500/80 cursor-pointer">
            Show Mermaid code
          </summary>
          <pre className="mt-2 text-xs bg-red-100 dark:bg-red-900/20 p-2 rounded overflow-x-auto">
            <code>{code}</code>
          </pre>
        </details>
      </div>
    );
  }

  return (
    <div className="my-4">
      {isRendering && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Rendering diagram...</span>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className="mermaid-diagram flex justify-center items-center overflow-x-auto bg-white dark:bg-gray-900 p-4 rounded-lg border border-border"
        style={{ minHeight: isRendering ? '100px' : 'auto' }}
      />
    </div>
  );
}
