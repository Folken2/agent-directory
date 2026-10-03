"""Structured blueprint of the agent a user designs with the builder.

The model emits it as a fenced ```blueprintjson block once the design is
settled; `callbacks/blueprint_document.py` validates it with these models and
stores it in session state under BLUEPRINT_STATE_KEY for the web UI.
Field names are camelCase on the wire to match the TypeScript types in
adk-web-ui/lib/blueprint.
"""

from __future__ import annotations

import json
import re
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from pydantic.alias_generators import to_camel

BLUEPRINT_STATE_KEY = "blueprint:document"
FENCE_RE = re.compile(r"```blueprintjson\s*([\s\S]*?)```", re.IGNORECASE)

AgentKind = Literal["llm", "sequential", "parallel", "loop", "custom"]
ToolKind = Literal["builtin", "function", "mcp", "openapi", "agent", "other"]


class _Model(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")


class BlueprintAgent(_Model):
    name: str = Field(min_length=1, max_length=80)
    role: str = Field(min_length=1, max_length=500)
    kind: AgentKind = "llm"
    model: Optional[str] = Field(default=None, max_length=80)
    tools: list[str] = Field(default_factory=list, max_length=20)
    sub_agents: list[str] = Field(default_factory=list, max_length=20)


class BlueprintTool(_Model):
    name: str = Field(min_length=1, max_length=80)
    kind: ToolKind = "function"
    purpose: str = Field(min_length=1, max_length=500)


class BlueprintDataSource(_Model):
    name: str = Field(min_length=1, max_length=120)
    purpose: str = Field(min_length=1, max_length=500)
    access: Optional[str] = Field(default=None, max_length=200)


class BlueprintModelChoice(_Model):
    model: str = Field(min_length=1, max_length=80)
    used_by: list[str] = Field(default_factory=list, max_length=20)
    reason: str = Field(min_length=1, max_length=500)


class Blueprint(_Model):
    name: str = Field(min_length=1, max_length=120)
    goal: str = Field(min_length=1, max_length=1000)
    agents: list[BlueprintAgent] = Field(min_length=1, max_length=20)
    tools: list[BlueprintTool] = Field(default_factory=list, max_length=30)
    data_sources: list[BlueprintDataSource] = Field(default_factory=list, max_length=20)
    models: list[BlueprintModelChoice] = Field(default_factory=list, max_length=10)
    risks: list[str] = Field(default_factory=list, max_length=20)
    next_steps: list[str] = Field(default_factory=list, max_length=20)
    code_skeleton: Optional[str] = Field(default=None, max_length=20_000)

    def to_state(self) -> dict:
        return self.model_dump(mode="json", by_alias=True, exclude_none=True)


def parse_blueprint(raw: object) -> Optional[Blueprint]:
    """Validated Blueprint or None (never raises)."""
    try:
        return Blueprint.model_validate(raw)
    except ValidationError:
        return None


def extract_blueprint(text: str) -> tuple[Optional[Blueprint], str]:
    """Find a ```blueprintjson fence in `text`.

    Returns (blueprint, display_text). The display text has the fence removed
    when it parsed; otherwise the original text is returned unchanged so a
    malformed block stays visible rather than silently disappearing.
    """
    match = FENCE_RE.search(text)
    if not match:
        return None, text
    try:
        raw = json.loads(match.group(1).strip())
    except json.JSONDecodeError:
        return None, text
    blueprint = parse_blueprint(raw)
    if not blueprint:
        return None, text
    return blueprint, FENCE_RE.sub("", text).strip()
