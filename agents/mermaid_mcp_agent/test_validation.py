"""
Test script for Mermaid MCP agent validation callback.

This script tests the validation callback by simulating tool calls with errors.
"""

from callbacks.validation_callback import after_tool_validation_callback
from unittest.mock import Mock


def test_validation_callback():
    """Test the validation callback with various scenarios."""

    print("=" * 60)
    print("Testing Mermaid Validation Callback")
    print("=" * 60)

    # Mock tool context
    mock_tool_context = Mock()
    mock_tool_context.state = {}

    # Mock tool
    mock_tool = Mock()
    mock_tool.name = "render-mermaid-diagram"

    # Test 1: Success case (no error)
    print("\n[Test 1] Success - No error in result")
    result_success = {"imageUrl": "https://example.com/diagram.png", "success": True}
    callback_result = after_tool_validation_callback(
        tool=mock_tool,
        args={"code": "graph TD; A-->B"},
        tool_response=result_success,
        tool_context=mock_tool_context
    )
    print(f"  Callback returned: {callback_result}")
    print(f"  State after: {mock_tool_context.state}")
    assert callback_result is None, "Should return None on success"
    assert mock_tool_context.state.get("mermaid_retry_count", 0) == 0
    print("  ✅ PASSED")

    # Test 2: First error (should allow retry)
    print("\n[Test 2] First error - Should store error and allow retry")
    mock_tool_context.state = {}
    result_error = {"error": "Syntax error: Unexpected ':' in label at line 3"}
    callback_result = after_tool_validation_callback(
        tool=mock_tool,
        args={"code": "graph TD; A[Step: 1]-->B"},
        tool_response=result_error,
        tool_context=mock_tool_context
    )
    print(f"  Callback returned: {callback_result}")
    print(f"  State after: {mock_tool_context.state}")
    assert callback_result is None, "Should return None to allow retry"
    assert mock_tool_context.state["mermaid_retry_count"] == 1
    assert "Syntax error" in mock_tool_context.state["mermaid_last_error"]
    print("  ✅ PASSED")

    # Test 3: Second error (should still allow retry)
    print("\n[Test 3] Second error - Should increment retry count")
    result_error2 = {"error": "Label spans multiple lines"}
    callback_result = after_tool_validation_callback(
        tool=mock_tool,
        args={"code": "graph TD; A[Step\nOne]-->B"},
        tool_response=result_error2,
        tool_context=mock_tool_context
    )
    print(f"  Callback returned: {callback_result}")
    print(f"  State after: {mock_tool_context.state}")
    assert callback_result is None, "Should return None to allow retry"
    assert mock_tool_context.state["mermaid_retry_count"] == 2
    print("  ✅ PASSED")

    # Test 4: Third error (should still allow retry)
    print("\n[Test 4] Third error - Should still allow one more retry")
    result_error3 = {"error": "Invalid node ID"}
    callback_result = after_tool_validation_callback(
        tool=mock_tool,
        args={"code": "graph TD; 123-->B"},
        tool_response=result_error3,
        tool_context=mock_tool_context
    )
    print(f"  Callback returned: {callback_result}")
    print(f"  State after: {mock_tool_context.state}")
    assert callback_result is None, "Should return None to allow retry"
    assert mock_tool_context.state["mermaid_retry_count"] == 3
    print("  ✅ PASSED")

    # Test 5: Fourth error (should block with max retries)
    print("\n[Test 5] Fourth error - Should block after max retries")
    result_error4 = {"error": "Still broken"}
    callback_result = after_tool_validation_callback(
        tool=mock_tool,
        args={"code": "graph TD; invalid"},
        tool_response=result_error4,
        tool_context=mock_tool_context
    )
    print(f"  Callback returned: {callback_result}")
    print(f"  State after: {mock_tool_context.state}")
    assert callback_result is not None, "Should return error dict after max retries"
    assert "Failed to generate valid Mermaid" in callback_result["error"]
    assert callback_result["give_up"] is True
    print("  ✅ PASSED")

    # Test 6: Success after errors (should reset state)
    print("\n[Test 6] Success after errors - Should reset retry count")
    mock_tool_context.state = {"mermaid_retry_count": 2, "mermaid_last_error": "Previous error"}
    result_success2 = {"imageUrl": "https://example.com/diagram2.png"}
    callback_result = after_tool_validation_callback(
        tool=mock_tool,
        args={"code": "graph TD; A-->B"},
        tool_response=result_success2,
        tool_context=mock_tool_context
    )
    print(f"  Callback returned: {callback_result}")
    print(f"  State after: {mock_tool_context.state}")
    assert callback_result is None, "Should return None on success"
    assert mock_tool_context.state["mermaid_retry_count"] == 0
    assert "mermaid_last_error" not in mock_tool_context.state
    print("  ✅ PASSED")

    # Test 7: Non-Mermaid tool (should pass through)
    print("\n[Test 7] Non-Mermaid tool - Should pass through")
    mock_tool_context.state = {}
    mock_tool_other = Mock()
    mock_tool_other.name = "web-search"
    result_other = {"results": ["some data"]}
    callback_result = after_tool_validation_callback(
        tool=mock_tool_other,
        args={"query": "test"},
        tool_response=result_other,
        tool_context=mock_tool_context
    )
    print(f"  Callback returned: {callback_result}")
    print(f"  State after: {mock_tool_context.state}")
    assert callback_result is None, "Should pass through non-Mermaid tools"
    assert len(mock_tool_context.state) == 0, "Should not modify state"
    print("  ✅ PASSED")

    print("\n" + "=" * 60)
    print("All tests PASSED! ✅")
    print("=" * 60)


if __name__ == "__main__":
    test_validation_callback()
