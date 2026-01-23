# Mermaid Agent Validation Improvements

## Overview

The Mermaid MCP agent has been enhanced with an automatic validation feedback loop that detects syntax errors and enables the LLM to self-correct without user intervention.

## Problem Statement

**Before:** The agent would generate Mermaid code that sometimes had syntax errors. When the MCP validation tool failed, the agent had no feedback mechanism to learn from the error and retry with corrected syntax. This resulted in rendering failures in the UI.

**After:** The agent now automatically detects validation errors, stores them in state, and uses them to guide retry attempts with corrected syntax.

## Solution Architecture

### 1. Validation Callback (`callbacks/validation_callback.py`)

A new `after_tool_callback` that:
- Intercepts all Mermaid tool results
- Detects errors in tool responses
- Implements retry logic (max 3 attempts)
- Stores error messages in session state
- Provides detailed logging for debugging

**Key Features:**
- ✅ Automatic error detection from MCP tool results
- ✅ State-based retry counting (`mermaid_retry_count`)
- ✅ Error message storage (`mermaid_last_error`)
- ✅ Graceful failure after max retries
- ✅ Automatic state reset on success

### 2. Enhanced Prompt (`prompt/prompt.py`)

The prompt now includes:
- **Error Recovery Section**: Detailed instructions on how to fix common Mermaid syntax errors
- **Retry Strategy**: Step-by-step guide for analyzing and fixing errors
- **State Variable Injection**: `{mermaid_last_error}` and `{mermaid_retry_count}` placeholders
- **DO/DON'T Rules**: Clear guidelines for error handling behavior

**Error Recovery Instructions:**
```
1. READ THE ERROR CAREFULLY - Contains specific details about what went wrong
2. IDENTIFY THE EXACT PROBLEM - Look for line numbers, character positions
3. FIX ONLY THE PROBLEMATIC SYNTAX - Common fixes documented
4. RETRY IMMEDIATELY - Do NOT give up after one failure
5. LEARN FROM ERRORS - Each error teaches you about Mermaid's syntax
```

### 3. Updated Agent Configuration (`agent.py`)

The agent now uses both callbacks:
- `before_agent_callback`: Dynamic tool discovery (existing)
- `after_tool_callback`: Validation feedback loop (new)

## How It Works

### The Validation Loop

```
User Request: "Create a flowchart for login process"
    ↓
Agent: Calls create-diagram tool
    ↓
Agent: Calls render-diagram tool
    ↓
[Callback Intercepts]
    ↓
Validation Error Detected: "Unexpected ':' in label"
    ↓
State Updated:
  - mermaid_retry_count = 1
  - mermaid_last_error = "Unexpected ':' in label"
    ↓
Error Propagates to LLM with State Context
    ↓
LLM Sees Error + State Variables in Prompt
    ↓
LLM: "I see the colon error, let me fix that..."
    ↓
LLM: Generates corrected code (removes colons)
    ↓
LLM: Calls render-diagram again
    ↓
[Callback Intercepts]
    ↓
Success! ✅
    ↓
State Reset:
  - mermaid_retry_count = 0
  - mermaid_last_error cleared
    ↓
User Sees: Beautiful rendered diagram
```

## Testing

A comprehensive test suite (`test_validation.py`) verifies:

1. ✅ Success case (no error)
2. ✅ First error (retry allowed)
3. ✅ Second error (retry count increments)
4. ✅ Third error (last retry allowed)
5. ✅ Fourth error (max retries blocks execution)
6. ✅ Success after errors (state reset)
7. ✅ Non-Mermaid tools (pass through)

All tests pass with proper logging output.

## Key Benefits

### For the Agent
- **Self-Correcting**: Automatically fixes syntax errors without user intervention
- **Learning Loop**: Each error provides specific guidance for improvement
- **Resilient**: Handles up to 3 retry attempts before failing gracefully

### For the User
- **Better Success Rate**: Most syntax errors are fixed automatically
- **Transparent**: Logging shows the retry process in terminal
- **Fail-Safe**: Clear error messages after max retries

### For Developers
- **Observable**: Enhanced logging with clear prefixes (`[MERMAID VALIDATION]`)
- **Testable**: Unit tests verify all error scenarios
- **Extensible**: Easy to adjust MAX_RETRIES or add more logic

## Configuration

### Adjusting Max Retries

Edit `callbacks/validation_callback.py`:

```python
MAX_RETRIES = 3  # Change to desired number
```

### Adding More Error Detection

The callback checks these error patterns:
- `result.get("error")`
- `result.get("errors")`
- `result.get("message")`
- `result.get("success") is False`
- String containing "error" or "invalid"

Add more patterns as needed.

## Logging Output

The callback provides detailed logging:

```
[MERMAID VALIDATION] Checking result from tool: render-diagram
[MERMAID VALIDATION] ❌ Syntax error detected (attempt 1/3):
Syntax error: Unexpected ':' in label at line 3
[MERMAID VALIDATION] 🔄 Error stored in state for LLM to fix and retry
[MERMAID VALIDATION] ✅ Valid Mermaid code generated after 1 retry attempt(s)
```

## Common Error Patterns Fixed

The agent can now automatically fix:

1. **Colons in labels**: `A[Step: 1]` → `A[Step 1]`
2. **Quotes in labels**: `A["Text"]` → `A[Text]`
3. **Multi-line labels**: `A[Line\nBreak]` → `A[Line Break]`
4. **Invalid node IDs**: `123[Node]` → `node123[Node]`
5. **Special characters**: `A[<Test>]` → `A[Test]`

## Critical Fixes

### Fix 1: Callback Parameter Names (CRITICAL)

**Problem:** ADK uses strict parameter name matching for callbacks. The `after_tool_callback` was using `result` as a parameter name, but ADK passes `tool_response`.

**Error:**
```
TypeError: after_tool_validation_callback() got an unexpected keyword argument 'tool_response'
```

**Solution:** Changed callback signature to use exact parameter names ADK expects:

```python
# ❌ WRONG: Incorrect parameter name
def after_tool_validation_callback(
    tool,
    args: dict[str, Any],
    result: Any,  # ❌ Wrong name!
    tool_context
):
    pass

# ✅ CORRECT: ADK-compatible parameter names
def after_tool_validation_callback(
    tool,
    args: dict[str, Any],
    tool_response: Any,  # ✅ Correct name!
    tool_context
):
    pass
```

**Key ADK Best Practice:** From the skill documentation:
> "⚠️ CRITICAL: Callback Parameter Names - ADK callbacks **must use exact parameter names** that the framework expects. Incorrect parameter names will cause runtime errors."

**Correct signatures for all callback types:**
```python
# before_tool_callback
def my_before_tool_callback(
    tool: BaseTool,
    args: dict[str, Any],
    tool_context: CallbackContext
) -> Optional[dict[str, Any]]:
    pass

# after_tool_callback
def my_after_tool_callback(
    tool: BaseTool,
    args: dict[str, Any],
    tool_response: Any,  # ← Must be 'tool_response'
    tool_context: CallbackContext
) -> Optional[dict[str, Any]]:
    pass
```

### Fix 2: State Variable Initialization

**Problem:** ADK requires all template variables in prompts to exist in state before interpolation. The prompt references `{mermaid_last_error}` and `{mermaid_retry_count}`, but these didn't exist on first run.

**Solution:** Enhanced `before_agent_callback_update_tools` in `config/utils.py` to initialize state variables with default values:
- `mermaid_retry_count = 0`
- `mermaid_last_error = ""`

**Key ADK Best Practice:** Always initialize state variables that are referenced in prompt templates, even if they start empty. ADK's template interpolation is strict and will fail with `KeyError` if variables don't exist.

**Code Pattern:**
```python
# In before_agent_callback
if "mermaid_retry_count" not in callback_context.state:
    callback_context.state["mermaid_retry_count"] = 0

if "mermaid_last_error" not in callback_context.state:
    callback_context.state["mermaid_last_error"] = ""
```

This follows ADK's state management best practices:
1. Initialize all template variables in `before_agent_callback`
2. Never remove state keys used in templates (set to empty/default instead)
3. Preserve existing values if already set (don't overwrite)

## Files Modified/Created

### Created
- `callbacks/__init__.py` - Package exports
- `callbacks/validation_callback.py` - Main validation logic
- `test_validation.py` - Comprehensive test suite
- `VALIDATION_IMPROVEMENTS.md` - This documentation

### Modified
- `agent.py` - Added after_tool_callback
- `prompt/prompt.py` - Added error recovery instructions and state variables

## Next Steps (Optional Enhancements)

1. **Pre-validation**: Add a validate-diagram tool call before rendering
2. **Pattern Caching**: Store successful Mermaid patterns in state for reuse
3. **Metrics**: Track success rate, average retries, common error types
4. **Error Parsing**: Extract specific line numbers and positions from errors
5. **A/B Testing**: Compare success rates before/after implementation

## References

- [ADK Callbacks Documentation](https://google.github.io/adk-docs/callbacks/)
- [MCP Tool Integration](https://google.github.io/adk-docs/tools/)
- [Agent State Management](https://google.github.io/adk-docs/sessions/state/)

---

**Implementation Date**: 2026-01-23
**Status**: ✅ Tested and Ready for Production
