import type { Agent, SubAgentStep } from '../types';
import { mergeStepText } from './text-assembly';

/**
 * Multi-agent routing: when an agent declares `finalSubAgent`, only that
 * author's text reaches the main bubble. Any other named author is an
 * intermediate step shown as collapsible progress.
 */
export function isIntermediateAuthor(
  agent: Pick<Agent, 'name' | 'finalSubAgent'>,
  author: string | undefined,
): author is string {
  return !!agent.finalSubAgent && !!author && author !== agent.finalSubAgent && author !== agent.name;
}

type ToolCallInput = { id: string; name: string; args?: Record<string, unknown>; status: string };

/**
 * Accumulates intermediate sub-agent steps. A switch to a new author closes
 * the previous running step; re-runs of the same author get a new runIndex.
 * Mutating methods return true when the visible state changed.
 */
export class SubAgentTracker {
  private steps: SubAgentStep[] = [];

  constructor(private readonly now: () => number = Date.now) {}

  get length(): number {
    return this.steps.length;
  }

  /** Running step for `author`, created if needed (tools/thinking may arrive before text). */
  private ensure(author: string): SubAgentStep {
    const last = this.steps[this.steps.length - 1];
    if (last && last.author === author && last.status === 'running') return last;
    if (last && last.status === 'running') {
      last.status = 'done';
      last.completedAt = this.now();
    }
    const step: SubAgentStep = {
      author,
      content: '',
      status: 'running',
      startedAt: this.now(),
      runIndex: this.steps.filter((s) => s.author === author).length + 1,
      tools: [],
    };
    this.steps.push(step);
    return step;
  }

  recordText(author: string, content: string): boolean {
    const step = this.ensure(author);
    const next = mergeStepText(step.content, content);
    if (next === step.content) return false;
    step.content = next;
    return true;
  }

  recordThinking(author: string, content: string): boolean {
    const step = this.ensure(author);
    const next = mergeStepText(step.thinking, content);
    if (next === step.thinking) return false;
    step.thinking = next;
    return true;
  }

  recordToolCall(author: string, tool: ToolCallInput): boolean {
    const step = this.ensure(author);
    if (!step.tools) step.tools = [];
    const status = tool.status === 'running' ? 'running' : 'pending';
    const existing = step.tools.find((t) => t.id === tool.id);
    if (existing) {
      existing.name = tool.name;
      existing.args = tool.args;
      existing.status = status;
    } else {
      step.tools.push({ id: tool.id, name: tool.name, args: tool.args, status });
    }
    return true;
  }

  hasTool(id: string): boolean {
    return this.steps.some((s) => s.tools?.some((t) => t.id === id));
  }

  /** Attach a tool response to the most recent step that issued the call. */
  recordToolResponse(response: { id: string; response: unknown; error?: string }): boolean {
    for (let i = this.steps.length - 1; i >= 0; i--) {
      const tool = this.steps[i].tools?.find((t) => t.id === response.id);
      if (!tool) continue;
      tool.response = response.response;
      tool.error = response.error;
      tool.status = response.error ? 'error' : 'completed';
      return true;
    }
    return false;
  }

  /** Mark every running step done (final author emitted, or the stream ended). */
  closeRunning(): boolean {
    let mutated = false;
    for (const s of this.steps) {
      if (s.status === 'running') {
        s.status = 'done';
        s.completedAt = this.now();
        mutated = true;
      }
    }
    return mutated;
  }

  /** Deep-enough copy for React state (steps and their tools). */
  snapshot(): SubAgentStep[] {
    return this.steps.map((s) => ({ ...s, tools: s.tools ? s.tools.map((t) => ({ ...t })) : undefined }));
  }
}
