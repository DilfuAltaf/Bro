import os
import logging
from typing import List, Dict
from duckduckgo_search import DDGS
from ...config import settings

logger = logging.getLogger("bro-agent-search")

class ResearchTool:
    def __init__(self):
        self.provider = getattr(settings, "WEB_SEARCH_PROVIDER", "duckduckgo")
        self.api_key = getattr(settings, "WEB_SEARCH_API_KEY", "")

    def search(self, query: str, max_results: int = 5) -> List[Dict[str, str]]:
        if self.provider == "duckduckgo":
            return self._search_duckduckgo(query, max_results)
        elif self.provider == "tavily":
            return self._search_tavily(query, max_results)
        else:
            logger.warning(f"Unknown search provider: {self.provider}. Falling back to duckduckgo.")
            return self._search_duckduckgo(query, max_results)

    def _search_duckduckgo(self, query: str, max_results: int) -> List[Dict[str, str]]:
        sources = []
        try:
            with DDGS() as ddgs:
                results = ddgs.text(query, max_results=max_results)
                for res in results:
                    sources.append({
                        "title": res.get("title", ""),
                        "url": res.get("href", ""),
                        "content": res.get("body", "")
                    })
        except Exception as e:
            logger.error(f"DuckDuckGo search failed for query '{query}': {e}")
        return sources

    def _search_tavily(self, query: str, max_results: int) -> List[Dict[str, str]]:
        if not self.api_key:
            logger.error("Tavily API key is missing.")
            return []
            
        import httpx
        sources = []
        try:
            # Simple synchronous wrapper for Tavily REST API
            response = httpx.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": self.api_key,
                    "query": query,
                    "search_depth": "basic",
                    "max_results": max_results,
                },
                timeout=10.0
            )
            response.raise_for_status()
            data = response.json()
            for res in data.get("results", []):
                sources.append({
                    "title": res.get("title", ""),
                    "url": res.get("url", ""),
                    "content": res.get("content", "")
                })
        except Exception as e:
            logger.error(f"Tavily search failed for query '{query}': {e}")
        return sources
