#!/usr/bin/env python3
"""
Validation script for agent directory structure.
Checks that each agent follows the required structure with minimal files:
- agent.py
- __init__.py
- metadata.json

Usage:
    python validate_agents.py [agent_directory_path]
"""

import json
import sys
from pathlib import Path
from typing import List, Dict, Tuple


class Colors:
    """ANSI color codes for terminal output."""
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


def validate_metadata_json(metadata_path: Path, agent_name: str) -> Tuple[bool, List[str]]:
    """Validate metadata.json file structure and required fields."""
    errors = []
    warnings = []

    # Check if file exists
    if not metadata_path.exists():
        errors.append(f"metadata.json is missing")
        return False, errors

    # Check if valid JSON
    try:
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)
    except json.JSONDecodeError as e:
        errors.append(f"metadata.json is not valid JSON: {e}")
        return False, errors

    # Required fields
    required_fields = ["name", "description", "tools"]
    for field in required_fields:
        if field not in metadata:
            errors.append(f"metadata.json missing required field: '{field}'")

    # Validate 'name' field matches directory name
    if "name" in metadata:
        if metadata["name"] != agent_name:
            errors.append(
                f"metadata.json 'name' field ('{metadata['name']}') "
                f"does not match directory name ('{agent_name}')"
            )
        if " " in metadata["name"]:
            errors.append("metadata.json 'name' field contains spaces (should be snake_case)")

    # Validate 'tools' is an array
    if "tools" in metadata and not isinstance(metadata["tools"], list):
        errors.append("metadata.json 'tools' field must be an array")

    # Recommended fields
    recommended_fields = ["displayName", "author", "tags"]
    for field in recommended_fields:
        if field not in metadata:
            warnings.append(f"metadata.json missing recommended field: '{field}'")

    return len(errors) == 0, errors + warnings


def validate_agent_py(agent_py_path: Path) -> Tuple[bool, List[str]]:
    """Validate agent.py file exists and is not empty."""
    errors = []

    if not agent_py_path.exists():
        errors.append("agent.py is missing")
        return False, errors

    # Check if file is not empty
    if agent_py_path.stat().st_size == 0:
        errors.append("agent.py is empty")
        return False, errors

    # Try to check basic Python syntax
    try:
        with open(agent_py_path, 'r') as f:
            content = f.read()
            compile(content, str(agent_py_path), 'exec')
    except SyntaxError as e:
        errors.append(f"agent.py has syntax errors: {e}")
        return False, errors

    return True, errors


def validate_init_py(init_py_path: Path) -> Tuple[bool, List[str]]:
    """Validate __init__.py file exists."""
    warnings = []

    if not init_py_path.exists():
        return False, ["__init__.py is missing"]

    # Check if it imports agent module (recommended but not required)
    try:
        with open(init_py_path, 'r') as f:
            content = f.read()
            if "from . import agent" not in content and "from .agent import" not in content:
                warnings.append("__init__.py does not import agent module (recommended)")
    except Exception:
        pass

    return True, warnings


def validate_directory_name(agent_name: str) -> Tuple[bool, List[str]]:
    """Validate that directory name is a valid Python identifier."""
    errors = []

    if not agent_name.isidentifier():
        errors.append(
            f"Directory name '{agent_name}' is not a valid Python identifier "
            "(use only alphanumeric characters and underscores)"
        )

    if " " in agent_name:
        errors.append(f"Directory name '{agent_name}' contains spaces")

    return len(errors) == 0, errors


def validate_recommended_files(agent_dir: Path) -> List[str]:
    """Check for recommended but not required files."""
    warnings = []

    if not (agent_dir / "README.md").exists():
        warnings.append("README.md is missing (highly recommended)")

    if not (agent_dir / "config" / "llm.py").exists():
        warnings.append("config/llm.py is missing (recommended)")

    if not (agent_dir / "prompt" / "prompt.py").exists():
        warnings.append("prompt/prompt.py is missing (recommended)")

    return warnings


def validate_agent(agent_dir: Path) -> Dict:
    """Validate a single agent directory."""
    agent_name = agent_dir.name
    results = {
        "name": agent_name,
        "path": str(agent_dir),
        "passed": True,
        "errors": [],
        "warnings": []
    }

    # Validate directory name
    valid, messages = validate_directory_name(agent_name)
    if not valid:
        results["passed"] = False
        results["errors"].extend(messages)

    # Validate required files
    metadata_valid, metadata_messages = validate_metadata_json(
        agent_dir / "metadata.json", agent_name
    )
    agent_py_valid, agent_py_messages = validate_agent_py(agent_dir / "agent.py")
    init_valid, init_messages = validate_init_py(agent_dir / "__init__.py")

    # Collect errors and warnings
    if not metadata_valid:
        results["passed"] = False
    if not agent_py_valid:
        results["passed"] = False
    if not init_valid:
        results["passed"] = False

    results["errors"].extend([msg for msg in metadata_messages if "missing required" in msg or "does not match" in msg or "not valid" in msg or "syntax" in msg])
    results["warnings"].extend([msg for msg in metadata_messages if msg not in results["errors"]])
    results["errors"].extend(agent_py_messages)
    results["errors"].extend([msg for msg in init_messages if "missing" in msg])
    results["warnings"].extend([msg for msg in init_messages if msg not in results["errors"]])

    # Check recommended files
    recommended_warnings = validate_recommended_files(agent_dir)
    results["warnings"].extend(recommended_warnings)

    return results


def print_results(results: List[Dict]) -> int:
    """Print validation results and return exit code."""
    total_agents = len(results)
    passed_agents = sum(1 for r in results if r["passed"])
    failed_agents = total_agents - passed_agents

    print(f"\n{Colors.BOLD}Validation Results{Colors.RESET}")
    print("=" * 80)

    for result in results:
        status_color = Colors.GREEN if result["passed"] else Colors.RED
        status_text = "PASS" if result["passed"] else "FAIL"

        print(f"\n{status_color}{Colors.BOLD}[{status_text}]{Colors.RESET} {result['name']}")
        print(f"  Path: {result['path']}")

        if result["errors"]:
            print(f"\n  {Colors.RED}Errors:{Colors.RESET}")
            for error in result["errors"]:
                print(f"    ✗ {error}")

        if result["warnings"]:
            print(f"\n  {Colors.YELLOW}Warnings:{Colors.RESET}")
            for warning in result["warnings"]:
                print(f"    ⚠ {warning}")

    print("\n" + "=" * 80)
    print(f"{Colors.BOLD}Summary:{Colors.RESET}")
    print(f"  Total agents: {total_agents}")
    print(f"  {Colors.GREEN}Passed: {passed_agents}{Colors.RESET}")
    if failed_agents > 0:
        print(f"  {Colors.RED}Failed: {failed_agents}{Colors.RESET}")

    return 0 if failed_agents == 0 else 1


def main():
    """Main entry point for validation script."""
    # Get agents directory path
    if len(sys.argv) > 1:
        agents_dir = Path(sys.argv[1])
    else:
        # Default to agents/ directory relative to script location
        script_dir = Path(__file__).parent.parent
        agents_dir = script_dir / "agents"

    if not agents_dir.exists():
        print(f"{Colors.RED}Error: Agents directory not found: {agents_dir}{Colors.RESET}")
        return 1

    # Find all agent directories (ignore pyproject.toml, uv.lock, etc.)
    agent_dirs = [
        d for d in agents_dir.iterdir()
        if d.is_dir() and not d.name.startswith('.') and not d.name.startswith('__')
    ]

    if not agent_dirs:
        print(f"{Colors.YELLOW}No agent directories found in {agents_dir}{Colors.RESET}")
        return 0

    print(f"{Colors.BLUE}Validating {len(agent_dirs)} agent(s) in {agents_dir}{Colors.RESET}")

    # Validate each agent
    results = []
    for agent_dir in sorted(agent_dirs):
        results.append(validate_agent(agent_dir))

    # Print results and return exit code
    exit_code = print_results(results)
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
