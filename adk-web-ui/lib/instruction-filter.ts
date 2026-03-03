/**
 * Filter internal agent instructions from response text
 * Removes system-level instructions that should not be displayed to users
 */

/**
 * Patterns that indicate internal instructions
 * These are common phrases used in system prompts that shouldn't appear in user-facing responses
 */
const INSTRUCTION_PATTERNS = [
  // Conditional instructions
  /if\s+(the\s+)?user'?s?\s+request\s+is/gi,
  /if\s+you\s+need\s+to/gi,
  /if\s+(the\s+)?user'?s?\s+request\s+is\s+a\s+follow-up/gi,
  
  // Directive instructions
  /be\s+sure\s+to\s+call/gi,
  /do\s+not\s+use\s+any\s+functions/gi,
  /do\s+not\s+use\s+functions\s+that\s+are\s+not\s+available/gi,
  /remember\s+to/gi,
  /you\s+should\s+(always\s+)?(remember\s+)?(to\s+)?/gi,
  /it\s+is\s+important\s+to/gi,
  /note\s+that/gi,
  /always\s+remember/gi,
  /make\s+sure\s+to/gi,
  /ensure\s+that/gi,
  /you\s+must/gi,
  /you\s+need\s+to/gi,
  
  // Tool usage instructions (in instructional context)
  /use\s+(the\s+)?load_artifacts\s+(function\s+)?(to|for|first)/gi,
  /call\s+(the\s+)?load_artifacts\s+(function\s+)?(to|for|first)/gi,
  /access\s+previously\s+generated/gi,
  /retrieve\s+them\s+(using|via|with)/gi,
  /call\s+.*\s+function\s+first\s+to\s+retrieve/gi,
  
  // Meta-instructions
  /following\s+(the|these)\s+instructions/gi,
  /according\s+to\s+(the\s+)?instructions/gi,
  /^here\s+is\s+your\s+.*:?\s*$/gi, // "Here is your X:" - instruction pattern (but check legitimate patterns first)
  
  // System-level guidance
  /in\s+the\s+provided\s+tool\s+definitions/gi,
  /available\s+in\s+the\s+provided\s+tool\s+definitions/gi,
  /not\s+available\s+in\s+the\s+provided\s+tool\s+definitions/gi,
  /provided\s+tool\s+definitions/gi,
];

/**
 * Patterns that indicate legitimate user-facing content (should NOT be filtered)
 * These help distinguish between instructions and legitimate explanations
 */
const LEGITIMATE_PATTERNS = [
  /^i'?ll?\s+/gi, // "I'll use..." - user-facing explanation
  /^i\s+(will|am|can)/gi, // "I will use..." - user-facing
  /^let\s+me/gi, // "Let me search..." - user-facing
  /^here'?s?\s+(what|how|the)/gi, // "Here's what I found..." - user-facing
  /^(the|this|that)\s+image/gi, // Referring to actual content
  /^(the|this|that)\s+result/gi, // Referring to actual results
];

/**
 * Check if a sentence is likely an instruction vs legitimate content
 */
function isInstructionSentence(sentence: string): boolean {
  const trimmed = sentence.trim();
  if (!trimmed) return false;
  
  // Check for legitimate patterns first (these should NOT be filtered)
  for (const pattern of LEGITIMATE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return false;
    }
  }
  
  // Check for instruction patterns
  for (const pattern of INSTRUCTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Filter internal instructions from text while preserving legitimate content
 * @param text - Raw agent response text
 * @returns Filtered text with instructions removed
 */
export function filterInternalInstructions(text: string): string {
  if (!text || typeof text !== 'string') {
    return text || '';
  }
  
  // Split into paragraphs first (preserve structure)
  const paragraphs = text.split(/\n\s*\n/);
  const filteredParagraphs: string[] = [];
  
  for (const paragraph of paragraphs) {
    // Check if entire paragraph is an instruction
    if (isInstructionSentence(paragraph.trim())) {
      continue; // Skip this paragraph
    }
    
    // Split paragraph into sentences
    // Use a regex that handles common sentence endings and markdown
    // Split on sentence boundaries: period, exclamation, question mark followed by space and capital letter
    const sentences = paragraph.split(/(?<=[.!?])\s+(?=[A-Z])/);
    const filteredSentences: string[] = [];
    
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (!trimmed) {
        continue;
      }
      
      // Skip instruction sentences
      if (!isInstructionSentence(trimmed)) {
        filteredSentences.push(sentence.trim());
      }
    }
    
    // Reconstruct paragraph if there are remaining sentences
    const filteredParagraph = filteredSentences.join(' ').trim();
    if (filteredParagraph) {
      filteredParagraphs.push(filteredParagraph);
    }
  }
  
  // Reconstruct text with preserved paragraph structure
  let result = filteredParagraphs.join('\n\n').trim();
  
  // Clean up excessive whitespace
  result = result.replace(/\n{3,}/g, '\n\n');
  result = result.replace(/[ \t]+/g, ' ');
  
  return result;
}

/**
 * Check if text contains any instruction patterns
 * Useful for debugging or conditional filtering
 */
export function containsInstructions(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }
  
  for (const pattern of INSTRUCTION_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  return false;
}
