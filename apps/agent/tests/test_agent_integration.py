"""Validation for the BroAgent agent service integration.

These tests cover the seams this service owns: the environment contract, the real
web-search adapter, and the safety boundary.
"""

from fastapi.testclient import TestClient

import pytest

from src.agent.tools import search as search_module
from src.agent.tools.search import ResearchTool
from src.config import Settings
from src.safety.crisis_detector import check_safety


class FakeDDGS:
    """Stands in for the DuckDuckGo client so the test never touches the network."""

    last_query = None

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def text(self, query, max_results=5):
        FakeDDGS.last_query = query
        return [
            {
                "title": "Real Result One",
                "href": "https://example.com/one",
                "body": "konten nyata satu",
            },
            {
                "title": "Real Result Two",
                "href": "https://example.com/two",
                "body": "konten nyata dua",
            },
        ][:max_results]


# --------------------------------------------------------------------------- #
# Environment contract
# --------------------------------------------------------------------------- #


def test_gemini_is_the_only_llm_provider_configured():
    fields = Settings.model_fields
    assert "GEMINI_API_KEY" in fields
    assert "GEMINI_MODEL" in fields
    # Hermes and Groq have been removed from the stack.
    assert "HERMES_BASE_URL" not in fields
    assert "HERMES_API_KEY" not in fields
    assert "GROQ_MODEL" not in fields
    assert "GROQ_API_KEY" not in fields


def test_gemini_model_has_a_current_default():
    settings = Settings(_env_file=None)
    assert settings.GEMINI_MODEL
    assert settings.GEMINI_MODEL != "gemini-2.0-flash"


# --------------------------------------------------------------------------- #
# Research: real search, real source shape
# --------------------------------------------------------------------------- #


def test_research_tool_returns_real_source_shape(monkeypatch):
    monkeypatch.setattr(search_module, "DDGS", FakeDDGS)
    tool = ResearchTool()
    results = tool.search("harga cpu terbaru")

    assert FakeDDGS.last_query == "harga cpu terbaru"
    assert len(results) == 2
    assert all({"title", "url", "content"} <= set(r) for r in results)
    assert results[0]["url"].startswith("https://")


def test_search_endpoint_contract_matches_what_nestjs_consumes(monkeypatch):
    """POST /agent/search must return {"results": [...]} with url/title/content."""
    monkeypatch.setattr(search_module, "DDGS", FakeDDGS)
    from src.main import app

    with TestClient(app) as client:
        response = client.post("/agent/search", json={"query": "belajar python"})

    assert response.status_code == 200
    payload = response.json()
    assert set(payload) == {"results"}
    assert payload["results"][0]["url"] == "https://example.com/one"


def test_search_degrades_to_empty_instead_of_faking_sources(monkeypatch):
    class BrokenDDGS(FakeDDGS):
        def text(self, query, max_results=5):
            raise RuntimeError("network down")

    monkeypatch.setattr(search_module, "DDGS", BrokenDDGS)
    assert ResearchTool().search("apa kabar") == []


# --------------------------------------------------------------------------- #
# Safety boundary
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    "text",
    ["aku ingin bunuh diri", "aku memang ingin mengakhiri hidup", "aku tidak ingin hidup"],
)
def test_crisis_text_is_flagged(text):
    result = check_safety({"messages": [{"role": "user", "content": text}]})
    assert result["safety_flag"] is True
    assert result["messages"][-1]["role"] == "assistant"


def test_normal_text_is_not_flagged():
    result = check_safety({"messages": [{"role": "user", "content": "tolong bantu tugas"}]})
    assert result["safety_flag"] is False
