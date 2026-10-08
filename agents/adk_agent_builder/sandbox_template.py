"""Build the E2B sandbox template the builder runs projects in.

Every nuvel project starts from the same requirements.txt, so the template
preinstalls it (plus pytest) on Python 3.11. run_checks then installs only
what a project adds, and starts in seconds instead of minutes.

    E2B_API_KEY=... python -m adk_agent_builder.sandbox_template [name]

Run it from agents/ in the backend environment, then set
BUILDER_E2B_TEMPLATE=<name> (default name: adk-agent-builder). Rebuild after
bumping nuvel, so the template matches its requirements.
"""

from __future__ import annotations

import sys
from pathlib import Path

import nuvel.backends.adk

from .sandbox import TEST_REQUIREMENTS

DEFAULT_NAME = "adk-agent-builder"
NUVEL_REQUIREMENTS = Path(nuvel.backends.adk.__file__).parent / "templates" / "requirements.txt"


def base_requirements() -> list[str]:
    """nuvel's template requirements plus the test runner.

    Comments and the scaffolder's {{placeholders}} (option-specific extras such
    as Composio or gateways) are dropped; run_checks installs those per project.
    """
    packages = []
    for line in NUVEL_REQUIREMENTS.read_text(encoding="utf-8").splitlines():
        spec = line.split("#", 1)[0].strip()
        if spec and "{{" not in spec:
            packages.append(spec)
    return packages + list(TEST_REQUIREMENTS)


def template():
    from e2b import Template

    return Template().from_python_image("3.11").pip_install(base_requirements())


def main(argv: list[str]) -> int:
    from e2b import Template

    name = argv[1] if len(argv) > 1 else DEFAULT_NAME
    print(f"Building E2B template {name!r} with:")
    for spec in base_requirements():
        print(f"  {spec}")
    info = Template.build(template(), name, on_build_logs=lambda entry: print(entry))
    print(f"Done: {info}. Set BUILDER_E2B_TEMPLATE={name}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
