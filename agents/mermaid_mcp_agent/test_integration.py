"""
Integration test for Mermaid agent with state initialization.

Tests the complete flow: state initialization → tool execution → error recovery.
"""

import asyncio
from unittest.mock import Mock, AsyncMock, patch
from config.utils import before_agent_callback_update_tools
from callbacks.validation_callback import after_tool_validation_callback


async def test_state_initialization():
    """Test that state variables are initialized correctly."""
    print("=" * 60)
    print("Testing State Initialization")
    print("=" * 60)

    # Create mock callback context
    mock_context = Mock()
    mock_context.state = {}

    # Create mock invocation context with a mock agent
    mock_agent = Mock()
    mock_agent.name = "test_agent"
    mock_agent.tools = []
    mock_agent.instruction = "Test instruction"

    mock_invocation_context = Mock()
    mock_invocation_context.agent = mock_agent
    mock_context._invocation_context = mock_invocation_context

    print("\n[Test] State initialization before callback")
    print(f"  Initial state: {mock_context.state}")

    # Call the before_agent_callback
    await before_agent_callback_update_tools(mock_context)

    print(f"  State after callback: {mock_context.state}")

    # Verify state variables are initialized
    assert "mermaid_retry_count" in mock_context.state, "mermaid_retry_count should be initialized"
    assert "mermaid_last_error" in mock_context.state, "mermaid_last_error should be initialized"
    assert mock_context.state["mermaid_retry_count"] == 0, "retry_count should be 0"
    assert mock_context.state["mermaid_last_error"] == "", "last_error should be empty"

    print("  ✅ State variables initialized correctly")

    # Test that reinitialization doesn't overwrite existing values
    print("\n[Test] Preserve existing state values")
    mock_context.state["mermaid_retry_count"] = 2
    mock_context.state["mermaid_last_error"] = "Some error"

    await before_agent_callback_update_tools(mock_context)

    assert mock_context.state["mermaid_retry_count"] == 2, "Should preserve existing retry_count"
    assert mock_context.state["mermaid_last_error"] == "Some error", "Should preserve existing error"

    print("  ✅ Existing state values preserved")
    print("\n" + "=" * 60)
    print("State Initialization Tests PASSED! ✅")
    print("=" * 60)


async def test_full_error_recovery_flow():
    """Test the complete error recovery flow."""
    print("\n" + "=" * 60)
    print("Testing Full Error Recovery Flow")
    print("=" * 60)

    # Simulate the flow
    state = {
        "mermaid_retry_count": 0,
        "mermaid_last_error": ""
    }

    mock_tool = Mock()
    mock_tool.name = "validate_and_render_mermaid_diagram"

    mock_tool_context = Mock()
    mock_tool_context.state = state

    # Step 1: First call fails
    print("\n[Step 1] First render attempt - Error returned")
    result_error = {"error": "Syntax error: Unexpected ':' in label"}

    callback_result = after_tool_validation_callback(
        tool=mock_tool,
        args={"code": "graph TD; A[Step: 1]-->B"},
        tool_response=result_error,
        tool_context=mock_tool_context
    )

    print(f"  State: retry_count={state['mermaid_retry_count']}")
    print(f"  State: last_error={state['mermaid_last_error'][:50]}...")
    assert state["mermaid_retry_count"] == 1, "Should increment retry count"
    assert "Syntax error" in state["mermaid_last_error"], "Should store error"
    print("  ✅ Error captured, retry count incremented")

    # Step 2: Second call succeeds
    print("\n[Step 2] Second render attempt - Success")
    result_success = {"imageUrl": "https://example.com/diagram.png"}

    callback_result = after_tool_validation_callback(
        tool=mock_tool,
        args={"code": "graph TD; A[Step 1]-->B"},
        tool_response=result_success,
        tool_context=mock_tool_context
    )

    print(f"  State: retry_count={state['mermaid_retry_count']}")
    print(f"  State: last_error='{state['mermaid_last_error']}'")
    assert state["mermaid_retry_count"] == 0, "Should reset retry count"
    assert "mermaid_last_error" not in state or state["mermaid_last_error"] == "", "Should clear error"
    print("  ✅ Success! State reset correctly")

    print("\n" + "=" * 60)
    print("Full Error Recovery Flow PASSED! ✅")
    print("=" * 60)


async def main():
    """Run all integration tests."""
    await test_state_initialization()
    await test_full_error_recovery_flow()
    print("\n" + "🎉 " * 20)
    print("ALL INTEGRATION TESTS PASSED!")
    print("🎉 " * 20)


if __name__ == "__main__":
    asyncio.run(main())
