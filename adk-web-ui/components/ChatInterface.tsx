'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useAppStore } from '@/lib/store';
import { adkClient } from '@/lib/adk-client';
import { Message, Artifact } from '@/lib/types';
import ToolStatusDisplay from './ToolStatusDisplay';
import ThinkingBlock from './ThinkingBlock';
import InlineArtifact from './InlineArtifact';
import MermaidDiagram from './MermaidDiagram';
import RateLimitBanner from './RateLimitBanner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { filterInternalInstructions } from '@/lib/instruction-filter';
import { Send, Paperclip, X, Loader2, Info, Copy, Check, Sparkles, Tag, Lightbulb, Wrench, AlertCircle } from 'lucide-react';
import { Components } from 'react-markdown';

interface ChatInterfaceProps {
  initialPrompt?: string;
}

// Safely parse a date, returning undefined if invalid
function safeParseDate(date: any): Date | undefined {
  if (!date) return undefined;
  try {
    const parsed = new Date(date);
    // Check if the date is valid
    if (isNaN(parsed.getTime())) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

// Extract user-friendly assistant text, hiding artifact-only metadata payloads
function getDisplayContent(raw: any): string {
  if (raw === null || raw === undefined) return '';

  const asString = typeof raw === 'string' ? raw : JSON.stringify(raw);
  const trimmed = asString.trim();
  if (!trimmed) return '';

  let extractedText = '';

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const keys = Object.keys(parsed);
      const hasArtifacts = Array.isArray((parsed as any).artifacts);
      const otherKeys = keys.filter((k) => k !== 'artifacts');

      // If it's only artifact metadata, hide it
      if (hasArtifacts && otherKeys.length === 0) {
        return '';
      }

      // Prefer common text fields if present
      if (typeof (parsed as any).response === 'string') {
        extractedText = (parsed as any).response.trim();
      } else if (typeof (parsed as any).text === 'string') {
        extractedText = (parsed as any).text.trim();
      } else if (typeof (parsed as any).message === 'string') {
        extractedText = (parsed as any).message.trim();
      } else {
        extractedText = trimmed;
      }
    } else {
      extractedText = trimmed;
    }
  } catch {
    // Not JSON, fall back to raw string
    extractedText = trimmed;
  }

  // Filter out internal instructions before returning
  return filterInternalInstructions(extractedText);
}

function autoGrowTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return;
  const maxHeight = 220; // px
  el.style.height = 'auto';
  const newHeight = Math.min(maxHeight, el.scrollHeight);
  el.style.height = `${newHeight}px`;
  const shouldScroll = el.scrollHeight > maxHeight;
  el.style.overflowY = shouldScroll ? 'auto' : 'hidden';
  // Subtle scrollbar hint on overflow
  el.style.scrollbarWidth = shouldScroll ? 'thin' : 'auto'; // Firefox
  (el.style as any).webkitOverflowScrolling = 'touch';
}

// Helper function to extract code string from ReactMarkdown children
function extractCodeString(children: any): string {
  if (typeof children === 'string') {
    return children;
  }
  if (Array.isArray(children)) {
    return children.map(extractCodeString).filter(Boolean).join('');
  }
  if (children && typeof children === 'object') {
    // Check if it's a React element with props
    if ('props' in children) {
      // If it has children, extract from children
      if (children.props?.children !== undefined) {
        return extractCodeString(children.props.children);
      }
    }
  }
  return '';
}

// Helper function to extract language from code element
function extractLanguage(children: any): string | null {
  if (Array.isArray(children)) {
    for (const child of children) {
      const lang = extractLanguage(child);
      if (lang) return lang;
    }
  } else if (children && typeof children === 'object' && 'props' in children) {
    const className = children.props?.className || '';
    const match = className.match(/language-(\w+)/);
    if (match) return match[1];
    return extractLanguage(children.props?.children);
  }
  return null;
}

export default function ChatInterface({ initialPrompt }: ChatInterfaceProps) {
  const {
    selectedAgent,
    currentConversation,
    setCurrentConversation,
    addMessage,
    updateMessage,
    addConversation,
    updateConversation,
    setArtifacts,
    addArtifact,
    setLoading,
    setError,
    isLoading,
    addToolCall,
    updateToolResponse,
    getToolsForMessage,
    activeTools,
  } = useAppStore();

  const [input, setInput] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingThinking, setStreamingThinking] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [currentAssistantMessageId, setCurrentAssistantMessageId] = useState<string | null>(null);
  const [currentMessageArtifacts, setCurrentMessageArtifacts] = useState<Artifact[]>([]);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    count: number;
    limit: number;
    userType: 'authenticated' | 'anonymous';
  } | null>(null);

  // Initialize info panel state based on screen size (mobile-first: closed by default)
  useEffect(() => {
    // Check if we're on desktop (≥1024px)
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    
    // Set initial state based on screen size
    const handleInitialState = () => {
      setInfoOpen(mediaQuery.matches);
    };
    
    // Check immediately
    handleInitialState();
    
    // Listen for changes (for orientation changes, window resizing, etc.)
    mediaQuery.addEventListener('change', handleInitialState);
    return () => mediaQuery.removeEventListener('change', handleInitialState);
  }, []);

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    
    checkDarkMode();
    
    // Watch for dark mode changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    
    return () => observer.disconnect();
  }, []);

  // Code block component with copy button and syntax highlighting - defined inside component to access isStreaming
  const CodeBlock = ({ children, ...props }: any) => {
    const [copied, setCopied] = useState(false);
    
    // Check if this is a Mermaid diagram by looking at the code element inside
    // ReactMarkdown structure: pre > code.language-mermaid > text
    const codeElement = Array.isArray(children) ? children[0] : children;
    const codeClassName = codeElement?.props?.className || '';
    const isMermaid = codeClassName.includes('language-mermaid');
    
    if (isMermaid) {
      // Extract the code string from the code element
      // The code element's children should be the actual text content
      let codeString = '';
      if (codeElement?.props?.children) {
        const children = codeElement.props.children;
        if (typeof children === 'string') {
          codeString = children;
        } else if (Array.isArray(children)) {
          codeString = children
            .map((child: any) => {
              if (typeof child === 'string') return child;
              if (child?.props?.children) {
                const childContent = child.props.children;
                if (typeof childContent === 'string') return childContent;
                if (Array.isArray(childContent)) {
                  return childContent
                    .map((c: any) => typeof c === 'string' ? c : '')
                    .join('');
                }
                return '';
              }
              return '';
            })
            .join('\n'); // Join with newlines to preserve line structure
        }
      } else {
        // Fallback: try extracting from the element itself
        codeString = extractCodeString(codeElement);
      }
      
      codeString = codeString.trim();
      if (codeString) {
        // Debug: log what we're extracting
        // While streaming, Mermaid code can be partial and cause parse errors / spam.
        // Defer rendering until the assistant message is finalized.
        if (isStreaming) {
          return (
            <div className="my-4 p-4 rounded-lg border border-border bg-card text-card-foreground">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span>Generating diagram&hellip;</span>
              </div>
            </div>
          );
        }

        return <MermaidDiagram code={codeString} />;
      }
    }
    
    // Extract code string and language
    const codeString = extractCodeString(children).trim();
    const match = codeClassName.match(/language-(\w+)/);
    const language = match ? match[1] : 'text';
    
    const handleCopy = () => {
      if (codeString) {
        navigator.clipboard.writeText(codeString.trim());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    };
    
    return (
      <div className="relative group my-4">
        <div className="relative rounded-lg overflow-hidden border border-border bg-[hsl(var(--md-surface-container-high))]">
          <Prism
            language={language}
            style={isDarkMode ? oneDark : oneLight}
            customStyle={{
              margin: 0,
              padding: '1rem',
              fontSize: '0.875rem',
              lineHeight: '1.6',
              background: 'transparent',
            }}
            PreTag="div"
            showLineNumbers={false}
            codeTagProps={{
              style: {
                background: 'transparent',
              },
            }}
          >
            {codeString}
          </Prism>
          {codeString && codeString.trim() && (
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 p-1.5 rounded-md bg-muted/90 hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity z-10 backdrop-blur-sm"
              title="Copy code"
              aria-label="Copy code"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  // Custom markdown components for better rendering - defined inside component to access isStreaming
  const markdownComponents: Components = {
    // Code blocks with copy button
    pre: CodeBlock,
    // Inline code
    code: ({ className, children, ...props }: any) => {
      return (
        <code className={`inline-code ${className || ''}`} {...props}>
          {children}
        </code>
      );
    },
    // Links - open in new tab
    a: ({ href, children, ...props }) => {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          {...props}
        >
          {children}
        </a>
      );
    },
  };

  const lastAppliedPromptRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobFile, setJobFile] = useState<File | null>(null);
  const [resumeLink, setResumeLink] = useState('');
  const [jobLink, setJobLink] = useState('');
  const [intakeError, setIntakeError] = useState<string | null>(null);
  const activeToolsList = Object.values(activeTools || {});

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentConversation?.messages, streamingContent, streamingThinking]);

  useEffect(() => {
    if (!isStreaming && inputRef.current) {
      inputRef.current.focus();
      autoGrowTextarea(inputRef.current);
    }
  }, [isStreaming]);

  useEffect(() => {
    autoGrowTextarea(inputRef.current);
  }, [input]);

  useEffect(() => {
    if (!initialPrompt) {
      lastAppliedPromptRef.current = null;
      return;
    }
    if (initialPrompt === lastAppliedPromptRef.current) return;
    lastAppliedPromptRef.current = initialPrompt;
    setInput(initialPrompt);
    setTimeout(() => {
      autoGrowTextarea(inputRef.current);
      inputRef.current?.focus();
    }, 0);
  }, [initialPrompt]);

  // Load existing artifacts when conversation changes and attach to last assistant message
  useEffect(() => {
    const loadExistingArtifacts = async () => {
      if (currentConversation && selectedAgent) {
        try {
          const sessionId = currentConversation.id.replace('conv-', 'session-');
          console.log('[ChatInterface] Loading existing artifacts for session:', sessionId);

          // Use the artifacts API endpoint to get existing artifacts
          const response = await fetch(`/api/artifacts?app_name=${selectedAgent.name}&user_id=default-user&session_id=${sessionId}`);

          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data && result.data.length > 0) {
              console.log('[ChatInterface] Loaded existing artifacts:', result.data);
              setArtifacts(result.data);

              // Attach artifacts to the last assistant message if it exists and doesn't already have artifacts
              const assistantMessages = currentConversation.messages.filter(m => m.role === 'assistant');
              if (assistantMessages.length > 0) {
                const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
                if (!lastAssistantMessage.artifacts || lastAssistantMessage.artifacts.length === 0) {
                  updateMessage(currentConversation.id, lastAssistantMessage.id, {
                    artifacts: result.data,
                  });
                }
              }
            } else {
              console.log('[ChatInterface] No existing artifacts found');
              setArtifacts([]); // Clear artifacts if none found
            }
          } else {
            console.log('[ChatInterface] Failed to load artifacts, clearing artifacts');
            setArtifacts([]); // Clear artifacts on error
          }
        } catch (error) {
          console.error('[ChatInterface] Error loading existing artifacts:', error);
          setArtifacts([]); // Clear artifacts on error
        }
      }
    };

    loadExistingArtifacts();
  }, [currentConversation?.id, selectedAgent?.name, setArtifacts, updateMessage]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCopyMessage = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(id);
      setTimeout(() => setCopiedMessageId((prev) => (prev === id ? null : prev)), 1500);
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleInsertPrompt = (prompt: string) => {
    setInput(prompt);
    setTimeout(() => {
      autoGrowTextarea(inputRef.current);
      inputRef.current?.focus();
    }, 0);
  };

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || !selectedAgent || isLoading || isStreaming || isInitializing) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim() || (attachments.length > 0 ? `Sent ${attachments.length} file(s)` : ''),
      timestamp: new Date(),
      agentName: selectedAgent.name,
    };

    // Initialize conversation if needed
    let conversation = currentConversation;
    if (!conversation) {
      conversation = {
        id: `conv-${Date.now()}`,
        title: input.trim().slice(0, 50) || 'New Conversation',
        agentName: selectedAgent.name,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      addConversation(conversation);
      setCurrentConversation(conversation);
    } else if ((!conversation.title || conversation.title === 'New Conversation') && input.trim()) {
      const updatedTitle = input.trim().slice(0, 50);
      conversation = { ...conversation, title: updatedTitle };
      setCurrentConversation(conversation);
      updateConversation(conversation.id, { title: updatedTitle });
    }

    addMessage(userMessage);
    const messageText = input.trim();
    setInput('');
    const filesToSend = [...attachments];
    setAttachments([]);
    setLoading(true);
    setIsInitializing(true);
    setIsStreaming(false);
    setStreamingContent('');
    setError(null);
    // Clear artifacts at the start of each request
    // Don't clear tools - they should persist with their messages
    setArtifacts([]);
    setCurrentMessageArtifacts([]);

    try {
      const assistantMessageId = `msg-${Date.now() + 1}`;
      setCurrentAssistantMessageId(assistantMessageId);
      let fullResponse = '';
      let fullThinking = '';
      let hasReceivedFirstChunk = false;

      // Get or create session ID for this conversation
      const sessionId = conversation.id.replace('conv-', 'session-');

      // Prepare message content with attachments
      let messageContent: string | { parts: Array<{ text?: string; inline_data?: any }> } = messageText;

      if (filesToSend.length > 0) {
        const parts: Array<{ text?: string; inline_data?: any }> = [];

        // Add text part if there's text
        if (messageText) {
          parts.push({ text: messageText });
        }

        // Add file parts
        for (const file of filesToSend) {
          const base64 = await convertFileToBase64(file);
          const mimeType = file.type || 'application/octet-stream';

          parts.push({
            inline_data: {
              mime_type: mimeType,
              data: base64,
              filename: file.name,
            },
          });
        }

        messageContent = { parts };
      }

      // Try streaming first
      try {
        let streamDone = false;
        let lastContentLength = 0;
        for await (const chunk of adkClient.streamAgent(
          selectedAgent.name,
          messageContent,
          'default-user',
          sessionId
        )) {
          // Once we receive the first chunk (any type), switch from initializing to streaming
          if (!hasReceivedFirstChunk) {
            hasReceivedFirstChunk = true;
            setIsInitializing(false);
            setIsStreaming(true);
          }
          if (chunk.type === 'thinking' && chunk.content) {
            // Handle thinking/reasoning content from thinking models
            const newThinking = chunk.content;
            setIsThinking(true);

            // Same dedup logic as text chunks
            if (newThinking === fullThinking && fullThinking.length > 0) {
              continue;
            }
            if (newThinking.length > fullThinking.length && newThinking.startsWith(fullThinking)) {
              fullThinking = newThinking;
            } else if (fullThinking.length > 0 && fullThinking.includes(newThinking)) {
              continue;
            } else {
              fullThinking += newThinking;
            }
            setStreamingThinking(fullThinking);
          } else if (chunk.type === 'text' && chunk.content) {
            // Once we get text, thinking phase is done
            if (isThinking) {
              setIsThinking(false);
            }

            const newContent = chunk.content;

            // Debug logging to understand ADK streaming behavior
            console.log('[ChatInterface] Text chunk received:', {
              newContentLength: newContent.length,
              newContentPreview: newContent.substring(0, 100),
              fullResponseLength: fullResponse.length,
            });

            // Skip exact duplicates
            if (newContent === fullResponse && fullResponse.length > 0) {
              console.log('[ChatInterface] Skipping exact duplicate');
              continue;
            }

            // If new content is longer and starts with what we have, it's accumulated - use it directly
            if (newContent.length > fullResponse.length && newContent.startsWith(fullResponse)) {
              console.log('[ChatInterface] Received accumulated content, replacing');
              fullResponse = newContent;
              setStreamingContent(fullResponse);
              continue;
            }

            // If new content shares the same opening as what we have, it's a cleaner
            // replacement (common with thinking models where garbled thinking precedes
            // the clean response). Use the longer/newer version.
            if (fullResponse.length > 50 && newContent.length > 50) {
              const prefixLen = Math.min(50, fullResponse.length, newContent.length);
              if (newContent.substring(0, prefixLen) === fullResponse.substring(0, prefixLen)) {
                console.log('[ChatInterface] Detected replacement with shared prefix, using newer content');
                fullResponse = newContent.length >= fullResponse.length ? newContent : fullResponse;
                setStreamingContent(fullResponse);
                continue;
              }
            }

            // If new content is already contained in what we have, skip it
            if (fullResponse.length > 0 && fullResponse.includes(newContent)) {
              console.log('[ChatInterface] Skipping already contained content');
              continue;
            }

            // Otherwise append as incremental delta
            console.log('[ChatInterface] Appending incremental delta');
            fullResponse += newContent;
            setStreamingContent(fullResponse);
          } else if (chunk.type === 'artifact' && chunk.artifact) {
            addArtifact(chunk.artifact);
            setCurrentMessageArtifacts(prev => [...prev, chunk.artifact!]);
          } else if (chunk.type === 'toolCall' && chunk.toolCall) {
            // Add tool call to store - mark as running when we receive the call
            // Associate it with the assistant message ID
            console.log('[ChatInterface] Tool call received:', chunk.toolCall);
            addToolCall({
              id: chunk.toolCall.id,
              name: chunk.toolCall.name,
              args: chunk.toolCall.args,
              status: 'running',
              isLongRunning: chunk.toolCall.status === 'running',
              startTime: new Date(),
            }, assistantMessageId);
          } else if (chunk.type === 'toolResponse' && chunk.toolResponse) {
            // Update tool response in store
            console.log('[ChatInterface] Tool response received:', chunk.toolResponse);
            updateToolResponse(
              chunk.toolResponse.id,
              chunk.toolResponse.response,
              chunk.toolResponse.error
            );
          } else if (chunk.type === 'error') {
            throw new Error(chunk.error || 'Streaming error');
          } else if (chunk.type === 'done') {
            streamDone = true;
            break;
          }
        }

        // Only add message after stream is completely done (no more data)
        // Stop streaming and clear streaming content BEFORE adding message to avoid duplicate display
        setIsStreaming(false);
        setIsThinking(false);
        setIsInitializing(false);
        setStreamingContent('');
        setStreamingThinking('');
        setCurrentAssistantMessageId(null);

        if (fullResponse && streamDone) {
          // Get final artifacts list (from session or current message artifacts)
          let finalArtifacts = currentMessageArtifacts;
          if (finalArtifacts.length === 0) {
            // Load any new artifacts that may have been created during the run
            try {
              const sessionId = conversation.id.replace('conv-', 'session-');
              const artifactsResponse = await fetch(`/api/artifacts?app_name=${selectedAgent.name}&user_id=default-user&session_id=${sessionId}`);
              if (artifactsResponse.ok) {
                const artifactsResult = await artifactsResponse.json();
                if (artifactsResult.success && artifactsResult.data && artifactsResult.data.length > 0) {
                  console.log('[ChatInterface] Loaded artifacts after streaming:', artifactsResult.data);
                  finalArtifacts = artifactsResult.data;
                  setArtifacts(artifactsResult.data);
                }
              }
            } catch (error) {
              console.error('[ChatInterface] Error loading artifacts after streaming:', error);
            }
          }

          console.log('[ChatInterface] Creating assistant message with artifacts:', {
            messageId: assistantMessageId,
            artifactCount: finalArtifacts.length,
            artifacts: finalArtifacts.map(a => ({ id: a.id, name: a.name, type: a.type, urlLength: a.url?.length || 0 }))
          });

          const assistantMessage: Message = {
            id: assistantMessageId,
            role: 'assistant',
            content: fullResponse,
            thinking: fullThinking || undefined,
            timestamp: new Date(),
            agentName: selectedAgent.name,
            artifacts: finalArtifacts.length > 0 ? finalArtifacts : undefined,
          };
          addMessage(assistantMessage);
          setCurrentMessageArtifacts([]);

          console.log('[ChatInterface] Message added, checking if artifacts are attached:', assistantMessage.artifacts?.length || 0);
        }
      } catch (streamError: any) {
        // Check if this is a rate limit error
        if (streamError?.status === 429 || streamError?.response?.status === 429 || streamError?.message?.includes('429')) {
          // Try to extract rate limit info from error
          let rateLimitData = null;
          try {
            if (streamError?.response?.data?.rateLimit) {
              rateLimitData = streamError.response.data.rateLimit;
            } else if (streamError?.rateLimit) {
              rateLimitData = streamError.rateLimit;
            }
          } catch (e) {
            // Ignore parsing errors
          }
          
          if (rateLimitData) {
            setRateLimitInfo({
              count: rateLimitData.count || 0,
              limit: rateLimitData.limit || 5,
              userType: rateLimitData.userType || 'anonymous',
            });
            setError(null); // Don't show error message, banner will show instead
            return; // Exit early, don't add error message
          }
        }
        
        // Clear any artifacts and thinking state that might have been added during failed streaming attempt
        setArtifacts([]);
        setIsInitializing(false);
        setIsThinking(false);
        setStreamingThinking('');

        // Fallback to non-streaming
        console.log('Streaming failed, falling back to regular request');
        const result = await adkClient.runAgent(
          selectedAgent.name,
          messageContent,
          'default-user',
          sessionId
        );

        if (result.status === 'error') {
          // Check if this is a rate limit error
          if (result.rateLimit) {
            setRateLimitInfo({
              count: result.rateLimit.count || 0,
              limit: result.rateLimit.limit || 5,
              userType: result.rateLimit.userType || 'anonymous',
            });
            setError(null);
            return; // Exit early, don't add error message
          }
          throw new Error(result.error || 'Failed to run agent');
        }

        // Get artifacts from result or load from session
        let finalArtifacts: Artifact[] = [];
        if (result.artifacts && result.artifacts.length > 0) {
          console.log('[UI] Setting artifacts:', result.artifacts);
          finalArtifacts = result.artifacts;
          setArtifacts(result.artifacts);
        } else {
          console.log('[UI] No artifacts in result');
          // Load artifacts from session in case they were saved but not returned in result
          try {
            const artifactsResponse = await fetch(`/api/artifacts?app_name=${selectedAgent.name}&user_id=default-user&session_id=${sessionId}`);
            if (artifactsResponse.ok) {
              const artifactsResult = await artifactsResponse.json();
              if (artifactsResult.success && artifactsResult.data && artifactsResult.data.length > 0) {
                console.log('[UI] Loaded artifacts from session after non-streaming:', artifactsResult.data);
                finalArtifacts = artifactsResult.data;
                setArtifacts(artifactsResult.data);
              }
            }
          } catch (error) {
            console.error('[UI] Error loading artifacts after non-streaming:', error);
          }
        }

        const assistantMessage: Message = {
          id: assistantMessageId,
          role: 'assistant',
          content: result.response || '',
          timestamp: new Date(),
          agentName: selectedAgent.name,
          artifacts: finalArtifacts.length > 0 ? finalArtifacts : undefined,
        };
        addMessage(assistantMessage);
        setCurrentMessageArtifacts([]);
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      
      // Check if this is a rate limit error
      if (error?.status === 429 || error?.response?.status === 429 || error?.message?.includes('429')) {
        // Try to extract rate limit info from error
        let rateLimitData = null;
        try {
          if (error?.response?.data?.rateLimit) {
            rateLimitData = error.response.data.rateLimit;
          } else if (error?.rateLimit) {
            rateLimitData = error.rateLimit;
          }
        } catch (e) {
          // Ignore parsing errors
        }
        
        if (rateLimitData) {
          setRateLimitInfo({
            count: rateLimitData.count || 0,
            limit: rateLimitData.limit || 5,
            userType: rateLimitData.userType || 'anonymous',
          });
          setError(null); // Don't show error message, banner will show instead
          return; // Exit early, don't add error message
        }
      }
      
      setError(error.message || 'Failed to send message');

      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${error.message || 'Failed to process your request. Please try again.'}`,
        timestamp: new Date(),
        agentName: selectedAgent.name,
      };
      addMessage(errorMessage);
    } finally {
      setLoading(false);
      setIsStreaming(false);
      setIsThinking(false);
      setIsInitializing(false);
      // Clear streaming content - message has been added if there was content
      setStreamingContent('');
      setStreamingThinking('');
      setCurrentAssistantMessageId(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const messages = currentConversation?.messages || [];
  const isResumeScreener = selectedAgent?.name === 'resume_screener';
  const shouldHideComposer = isResumeScreener && messages.length === 0 && !isStreaming && !isInitializing;

  const handleResumeStart = () => {
    if (!selectedAgent) return;
    const hasResume = resumeFile || resumeLink.trim();
    const hasJob = jobFile || jobLink.trim();
    if (!hasResume || !hasJob) {
      setIntakeError('Please provide both a resume (file or link) and a job description (file or link).');
      return;
    }
    setIntakeError(null);

    const summaryLines = [
      'Resume screening request:',
      `Resume: ${resumeFile ? resumeFile.name : resumeLink.trim()}`,
      `Job: ${jobFile ? jobFile.name : jobLink.trim()}`,
    ];
    const composedMessage = summaryLines.join('\n');

    const newAttachments: File[] = [];
    if (resumeFile) newAttachments.push(resumeFile);
    if (jobFile) newAttachments.push(jobFile);

    setInput(composedMessage);
    setAttachments(newAttachments);
    setTimeout(() => {
      handleSend();
    }, 0);
  };

  const gridColsClass = infoOpen ? "grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]" : "grid-cols-1";

  return (
    <div className={cn("grid gap-4 h-full", gridColsClass)}>
      <div className="flex flex-col h-full min-h-0 bg-background relative">
        <div className="px-4 pt-3 flex items-center justify-end gap-3">
          <button
            onClick={() => setInfoOpen((open) => !open)}
            className="inline-flex items-center justify-center rounded-full border border-border bg-card hover:border-primary/40 p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={infoOpen ? 'Hide agent info' : 'Show agent info'}
            title={infoOpen ? 'Hide agent info' : 'Show agent info'}
          >
            <Info className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6">
          {rateLimitInfo && (
            <RateLimitBanner
              count={rateLimitInfo.count}
              limit={rateLimitInfo.limit}
              userType={rateLimitInfo.userType}
              onDismiss={() => setRateLimitInfo(null)}
            />
          )}
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <h2 className="text-3xl font-light tracking-tight text-foreground">
                How can I help you today?
              </h2>
              {isResumeScreener && (
                <div className="w-full max-w-3xl text-left space-y-4">
                  <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="w-4 h-4 text-primary" />
                      <h3 className="text-base font-semibold text-foreground">Resume intake</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Provide a resume and the job description (file or link), then click Start to begin screening.
                    </p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resume file</label>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.txt"
                          onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                          className="block w-full h-[52px] text-sm text-foreground file:h-full file:mr-3 file:px-3 file:py-2 file:border file:border-border file:rounded-lg file:bg-muted file:text-foreground file:text-sm file:cursor-pointer bg-card border border-border rounded-lg px-3 py-2"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resume link</label>
                        <input
                          type="url"
                          value={resumeLink}
                          onChange={(e) => setResumeLink(e.target.value)}
                          placeholder="https://..."
                          className="w-full h-[52px] rounded-lg border border-border bg-card px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Job file</label>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.txt"
                          onChange={(e) => setJobFile(e.target.files?.[0] || null)}
                          className="block w-full h-[52px] text-sm text-foreground file:h-full file:mr-3 file:px-3 file:py-2 file:border file:border-border file:rounded-lg file:bg-muted file:text-foreground file:text-sm file:cursor-pointer bg-card border border-border rounded-lg px-3 py-2"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Job link</label>
                        <input
                          type="url"
                          value={jobLink}
                          onChange={(e) => setJobLink(e.target.value)}
                          placeholder="https://..."
                          className="w-full h-[52px] rounded-lg border border-border bg-card px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                    {intakeError && (
                      <div className="mt-3 text-sm text-destructive flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {intakeError}
                      </div>
                    )}
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={handleResumeStart}
                        disabled={isLoading || isStreaming || isInitializing}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-colors disabled:opacity-50"
                      >
                        Start
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {!isResumeScreener && selectedAgent?.samplePrompts && selectedAgent.samplePrompts.length > 0 && (
                <div className="flex flex-col gap-3 items-center">
                  <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Sparkles className="w-3 h-3" />
                    Try this
                  </span>
                  <div className="flex flex-wrap justify-center gap-2">
                    {selectedAgent.samplePrompts.slice(0, 6).map((prompt, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleInsertPrompt(prompt)}
                        className="px-3 py-1.5 rounded-full text-xs bg-muted text-foreground border border-border hover:border-primary/40 hover:shadow-sm transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                    {selectedAgent.samplePrompts.length > 6 && (
                      <span className="text-[11px] text-muted-foreground">
                        +{selectedAgent.samplePrompts.length - 6} more in agent details
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex w-full",
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
                title={safeParseDate(message.timestamp)?.toLocaleString()}
              >
                {message.role === 'assistant' ? (
                  <div className="max-w-3xl w-full space-y-2">
                    {/* Tool Status - Rendered on top */}
                    {getToolsForMessage(message.id).length > 0 && (
                      <ToolStatusDisplay messageId={message.id} />
                    )}
                    {/* Thinking Block - Rendered above message content */}
                    {message.thinking && (
                      <ThinkingBlock content={message.thinking} />
                    )}
                    {/* Message Content */}
                    {(() => {
                      const displayContent = getDisplayContent(message.content);
                      const hasArtifacts = !!(message.artifacts && message.artifacts.length > 0);

                      if (!displayContent && !hasArtifacts) return null;

                      return (
                        <div className="bg-card text-card-foreground border border-border rounded-2xl px-6 py-4 shadow-sm">
                          <div className="flex items-center justify-between gap-2 mb-2 text-xs text-muted-foreground">
                            <span>{safeParseDate(message.timestamp)?.toLocaleTimeString() || ''}</span>
                            {displayContent && (
                              <button
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted/70 transition-colors text-foreground/70"
                                onClick={() => handleCopyMessage(displayContent, message.id)}
                              >
                                {copiedMessageId === message.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                <span>{copiedMessageId === message.id ? 'Copied' : 'Copy'}</span>
                              </button>
                            )}
                          </div>
                          {displayContent && (
                            <div className="markdown-content">
                              <ReactMarkdown 
                                remarkPlugins={[remarkGfm]} 
                                components={markdownComponents}
                              >
                                {displayContent}
                              </ReactMarkdown>
                            </div>
                          )}
                          {hasArtifacts && (
                            <div className={displayContent ? "mt-4 space-y-3" : "space-y-3"}>
                              {message.artifacts!.map((artifact) => (
                                <InlineArtifact key={artifact.id} artifact={artifact} />
                              ))}
                            </div>
                          )}
                          {hasArtifacts && message.artifacts!.length > 1 && (
                            <div className="mt-3 flex justify-end">
                              <button
                                className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-md bg-muted hover:bg-muted/80 transition-colors"
                                onClick={() => {
                                  message.artifacts?.forEach((a) => {
                                    const link = document.createElement('a');
                                    link.href = a.url;
                                    link.download = a.name;
                                    link.click();
                                  });
                                }}
                              >
                                Download all
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div
                    className="max-w-3xl rounded-2xl px-6 py-4 shadow-sm bg-primary text-primary-foreground"
                  >
                    <div className="markdown-content user-message">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={markdownComponents}
                      >
                        {typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {isStreaming && currentAssistantMessageId && !messages.find(m => m.id === currentAssistantMessageId) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="max-w-3xl w-full space-y-2">
                {/* Tool Status - Rendered on top */}
                {getToolsForMessage(currentAssistantMessageId).length > 0 && (
                  <ToolStatusDisplay messageId={currentAssistantMessageId} />
                )}
                {/* Thinking Block - Rendered above message during streaming */}
                {streamingThinking && (
                  <ThinkingBlock content={streamingThinking} isStreaming={isThinking} />
                )}
                {/* Message Content */}
                <div className="bg-card text-card-foreground border border-border rounded-2xl px-6 py-4 shadow-sm">
                  {(() => {
                    const displayContent = getDisplayContent(streamingContent);
                    if (displayContent) {
                      return (
                        <>
                          <div className="markdown-content">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={markdownComponents}
                            >
                              {displayContent}
                            </ReactMarkdown>
                          </div>
                          <div className="flex items-center mt-3 gap-2">
                            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                            <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Generating</span>
                          </div>
                        </>
                      );
                    }
                    // If we're in thinking phase, show the thinking indicator instead of generic "Thinking..."
                    if (isThinking && streamingThinking) {
                      return null; // ThinkingBlock above handles the display
                    }
                    return (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Thinking...</span>
                      </div>
                    );
                  })()}
                  {currentMessageArtifacts.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {currentMessageArtifacts.map((artifact) => (
                        <InlineArtifact key={artifact.id} artifact={artifact} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {isInitializing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="flex items-center space-x-2 p-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Thinking...</span>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {!shouldHideComposer && (
          <div className="p-4 pt-6 bg-background/90 backdrop-blur-lg sticky bottom-0 z-10">
            <div className="pointer-events-none absolute inset-x-0 -top-4 h-6 bg-linear-to-t from-background to-transparent" />
            <div className="max-w-4xl mx-auto relative space-y-3">

            {attachments.length > 0 && (
              <div className="mb-1 flex flex-wrap gap-2">
                {attachments.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full text-xs font-medium"
                  >
                    <Paperclip className="w-3 h-3 text-muted-foreground" />
                    <span className="truncate max-w-[150px]">{file.name}</span>
                    <button
                      onClick={() => removeAttachment(index)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div
              className={cn(
                "relative flex items-center gap-3 bg-card border border-border rounded-2xl shadow-sm focus-within:ring-1 focus-within:ring-ring/60 focus-within:border-ring/80 transition-all px-3 py-2",
                (!selectedAgent || isLoading || isStreaming || isInitializing) && "opacity-90"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!selectedAgent || isLoading || isStreaming || isInitializing}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-xl transition-colors disabled:opacity-50"
                title="Attach files"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  autoGrowTextarea(e.target);
                }}
                onKeyPress={handleKeyPress}
                placeholder={
                  selectedAgent
                    ? `Message ${selectedAgent.name}...`
                    : 'Select an agent first'
                }
                disabled={!selectedAgent || isLoading || isStreaming || isInitializing}
                rows={1}
                className="flex-1 bg-transparent border-none outline-none focus:outline-none focus:ring-0 resize-none py-3 text-sm placeholder:text-muted-foreground leading-6 overflow-hidden"
                style={{ minHeight: '44px', maxHeight: '220px' }}
              />

              <button
                onClick={handleSend}
                disabled={(!input.trim() && attachments.length === 0) || !selectedAgent || isLoading || isStreaming || isInitializing}
                className={cn(
                  "h-10 w-10 inline-flex items-center justify-center rounded-full transition-all duration-200",
                  (!input.trim() && attachments.length === 0) || !selectedAgent || isLoading || isStreaming || isInitializing
                    ? "bg-muted text-muted-foreground opacity-60 cursor-not-allowed"
                    : "bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
                )}
                title="Send message"
              >
                {isLoading || isStreaming || isInitializing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
            <div className="text-center flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
              <Info className="w-3 h-3" />
              <span>AI can make mistakes. Please verify important information.</span>
            </div>
            </div>
          </div>
        )}
      </div>

      <div
        className={cn(
          "bg-card rounded-2xl border border-border shadow-sm overflow-y-auto p-4 xl:p-6",
          infoOpen ? "block" : "hidden"
        )}
      >
        {selectedAgent ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-[11px] font-semibold bg-primary/10 text-primary rounded-md border border-primary/20">
                    Agent
                  </span>
                  <span className="text-xs text-muted-foreground">{selectedAgent.name}</span>
                </div>
                <h3 className="text-lg font-semibold text-foreground mt-1 leading-tight">
                  {selectedAgent.displayName || selectedAgent.name}
                </h3>
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              {selectedAgent.description || 'No description available'}
            </p>

            {selectedAgent.tags && selectedAgent.tags.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Tag className="w-3 h-3" />
                  <span>Tags</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedAgent.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1.5 text-xs font-medium bg-primary/5 text-primary rounded-lg border border-primary/20"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedAgent.tools && selectedAgent.tools.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Wrench className="w-3 h-3" />
                  <span>Tools</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedAgent.tools.map((tool) => (
                    <span
                      key={tool}
                      className="px-2.5 py-1 text-xs font-medium bg-muted text-muted-foreground rounded-md border border-border/50"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedAgent.useCases && selectedAgent.useCases.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Lightbulb className="w-3 h-3 text-amber-500" />
                  <span>Use cases</span>
                </div>
                <div className="space-y-2">
                  {selectedAgent.useCases.map((useCase, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 text-sm text-foreground leading-relaxed bg-muted/30 border border-border/60 rounded-lg px-3 py-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 inline-flex" />
                      <span>{useCase}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Select an agent to view details and quick prompts.
          </div>
        )}
      </div>
    </div>
  );
}

