import type { Agent, Artifact, MapsCapture, StreamChunk, SubAgentStep, ToolCall, ToolResponse } from '../types';
import type { GuideDocument } from '../guide/types';
import { resolveGuideMessageContent } from '../guide/parse';
import type { Blueprint } from '../blueprint/types';
import { resolveBlueprintContent } from '../blueprint/parse';
import { mergeFinalText, mergeMainThinking } from './text-assembly';
import { SubAgentTracker, isIntermediateAuthor } from './sub-agent-steps';

/** What the UI must do after one chunk. Absent fields mean "no change". */
export type StreamUpdate = {
  /** Main-bubble text, when it changed. */
  content?: string;
  /** Main-bubble reasoning, when it changed. */
  thinking?: string;
  /** true while the main author is reasoning, false once it emits text. */
  thinkingActive?: boolean;
  /** Sub-agent steps, when they changed. */
  subAgentSteps?: SubAgentStep[];
  artifact?: Artifact;
  /** A tool call from the main author (intermediate calls go into the steps). */
  toolCall?: ToolCall;
  /** Name of any tool call, intermediate or not, for analytics. */
  toolCallName?: string;
  /** A tool response for the main author's flat tool list. */
  toolResponse?: ToolResponse;
  error?: { message: string; code?: string };
  done?: boolean;
};

export type AssembledMessage = {
  content: string;
  thinking?: string;
  subAgentSteps?: SubAgentStep[];
  mapsCaptures?: MapsCapture[];
  guideDocument?: GuideDocument;
  blueprint?: Blueprint;
};

/**
 * Pure reducer over the SSE chunk stream for one assistant turn: dedupes
 * text, routes sub-agent output, and collects maps/guide payloads. React
 * state lives in the hook; this only computes it.
 */
export class StreamAssembler {
  content = '';
  thinking = '';
  readonly steps: SubAgentTracker;
  private readonly mapsCaptures: MapsCapture[] = [];
  private guideDocument: GuideDocument | undefined;
  private blueprint: Blueprint | undefined;

  constructor(private readonly agent: Pick<Agent, 'name' | 'finalSubAgent'>, now: () => number = Date.now) {
    this.steps = new SubAgentTracker(now);
  }

  apply(chunk: StreamChunk): StreamUpdate {
    switch (chunk.type) {
      case 'thinking': {
        if (!chunk.content) return {};
        if (isIntermediateAuthor(this.agent, chunk.author)) {
          return this.steps.recordThinking(chunk.author, chunk.content) ? { subAgentSteps: this.steps.snapshot() } : {};
        }
        const next = mergeMainThinking(this.thinking, chunk.content);
        if (next === this.thinking) return { thinkingActive: true };
        this.thinking = next;
        return { thinkingActive: true, thinking: next };
      }
      case 'text': {
        if (!chunk.content) return {};
        if (isIntermediateAuthor(this.agent, chunk.author)) {
          return this.steps.recordText(chunk.author, chunk.content) ? { subAgentSteps: this.steps.snapshot() } : {};
        }
        // The final author emitted, so every intermediate step is done.
        const update: StreamUpdate = { thinkingActive: false };
        if (this.steps.closeRunning()) update.subAgentSteps = this.steps.snapshot();
        const next = mergeFinalText(this.content, chunk.content);
        if (next !== this.content) {
          this.content = next;
          update.content = next;
        }
        return update;
      }
      case 'artifact':
        return chunk.artifact ? { artifact: chunk.artifact } : {};
      case 'toolCall': {
        if (!chunk.toolCall) return {};
        const call = chunk.toolCall;
        if (isIntermediateAuthor(this.agent, chunk.author)) {
          this.steps.recordToolCall(chunk.author, call);
          return { toolCallName: call.name, subAgentSteps: this.steps.snapshot() };
        }
        return { toolCallName: call.name, toolCall: call };
      }
      case 'toolResponse': {
        if (!chunk.toolResponse) return {};
        // Prefer nesting under a sub-agent step when the id matches.
        if (this.steps.hasTool(chunk.toolResponse.id) || isIntermediateAuthor(this.agent, chunk.author)) {
          return this.steps.recordToolResponse(chunk.toolResponse) ? { subAgentSteps: this.steps.snapshot() } : {};
        }
        return { toolResponse: chunk.toolResponse };
      }
      case 'mapsCapture':
        if (chunk.mapsCapture) this.mapsCaptures.push(chunk.mapsCapture);
        return {};
      case 'guideDocument':
        if (chunk.guideDocument) this.guideDocument = chunk.guideDocument;
        return {};
      case 'blueprint':
        if (chunk.blueprint) this.blueprint = chunk.blueprint;
        return {};
      case 'error':
        return { error: { message: chunk.error, code: chunk.code } };
      case 'done':
        return { done: true };
    }
  }

  /**
   * The assistant message for this turn. Closes running steps and resolves
   * the guide document and blueprint (state_delta first, fenced-JSON
   * fallback) so the
   * stored `content` is the lead text rather than raw JSON.
   */
  finalize({ includeExtras = true }: { includeExtras?: boolean } = {}): AssembledMessage {
    this.steps.closeRunning();
    const resolved = resolveGuideMessageContent(this.content, this.guideDocument);
    // Blueprint: state_delta first, ```blueprintjson fence as the fallback.
    const bp = resolveBlueprintContent(resolved.content, this.blueprint);
    return {
      content: bp.content,
      blueprint: bp.blueprint,
      thinking: this.thinking || undefined,
      subAgentSteps: includeExtras && this.steps.length > 0 ? this.steps.snapshot() : undefined,
      mapsCaptures: includeExtras && this.mapsCaptures.length > 0 ? [...this.mapsCaptures] : undefined,
      guideDocument: resolved.guideDocument,
    };
  }
}
