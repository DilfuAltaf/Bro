import json
from ...config import settings
from ..state import AgentState
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from ..tools.search import ResearchTool

MAX_SEARCH_ITERATIONS = 2

def generate_search_query(llm, messages, memories):
    """Generates a search query based on conversation history and memory."""
    from ..utils import build_prompt
    
    sys_prompt = (
        "Anda adalah AI asisten peneliti. Tugas Anda adalah menghasilkan SATU string query pencarian yang "
        "paling relevan berdasarkan percakapan terakhir pengguna.\n"
        "HANYA outputkan query-nya saja, tanpa tanda kutip, tanpa penjelasan tambahan. Jika pengguna "
        "tidak membutuhkan riset, kembalikan 'NO_SEARCH'."
    )
    prompt = build_prompt(messages, sys_prompt, memories)
    response = llm.invoke(prompt)
    query = response.content.strip()
    
    # Remove quotes if generated
    if query.startswith('"') and query.endswith('"'):
        query = query[1:-1]
        
    return query

def synthesize_answer(llm, messages, memories, search_results, sources):
    """Synthesizes the final answer using search results."""
    from ..utils import build_prompt
    
    context_blocks = []
    for idx, res in enumerate(search_results):
        context_blocks.append(f"Source [{idx+1}]: {res['title']}\n{res['content']}")
    
    search_context = "\n\n".join(context_blocks)
    
    sys_prompt = (
        "Anda adalah asisten AI (BroAgent) yang membantu memberikan jawaban riset.\n"
        "Karakter response: natural, membantu, tidak terlalu formal, jelas, jangan selalu memakai format bullet.\n"
        "Anda telah melakukan pencarian web dan menemukan informasi berikut:\n\n"
        f"{search_context}\n\n"
        "Berdasarkan informasi di atas, berikan jawaban komprehensif atas pertanyaan terakhir pengguna.\n"
        "Sertakan referensi nomor [1], [2], dst jika Anda mengutip fakta dari sumber.\n"
        "Jika informasi dari pencarian tidak cukup untuk menjawab pertanyaan dengan akurat, katakan bahwa "
        "Anda tidak menemukan informasi yang cukup dan berikan ringkasan dari apa yang Anda temukan saja.\n"
        "JANGAN mengarang fakta yang tidak ada di dalam hasil pencarian."
    )
    
    prompt = build_prompt(messages, sys_prompt, memories)
    response = llm.invoke(prompt)
    return response.content

def research_node(state: AgentState) -> dict:
    messages = state.get("messages", [])
    memories = state.get("memories", [])
    
    if not messages:
        return {"messages": [{"role": "assistant", "content": "Halo! Topik riset apa yang ingin Anda eksplorasi?"}], "current_skill": "research"}
    
    if not settings.GEMINI_API_KEY:
        return {"messages": messages + [{"role": "assistant", "content": "Maaf, kunci API belum dikonfigurasi. Fitur riset belum tersedia."}], "current_skill": "research"}
    
    try:
        llm = ChatGoogleGenerativeAI(model=settings.GEMINI_MODEL, api_key=settings.GEMINI_API_KEY)
        tool = ResearchTool()
        
        # 1. Generate Query
        query = generate_search_query(llm, messages, memories)
        
        if query == "NO_SEARCH" or not query:
            # Fallback if no search needed
            from ..utils import build_prompt
            prompt = build_prompt(messages, "Anda adalah asisten AI (BroAgent).", memories)
            response = llm.invoke(prompt)
            return {"messages": messages + [{"role": "assistant", "content": response.content}], "current_skill": "research"}
            
        # 2. Web Search (Iteration loop)
        search_results = []
        sources = []
        iterations = 0
        current_query = query
        
        while iterations < MAX_SEARCH_ITERATIONS:
            results = tool.search(current_query)
            if results:
                search_results.extend(results)
                sources.extend(results)
                # For simplicity in MVP, we just use the first successful search
                break
            else:
                iterations += 1
                if iterations < MAX_SEARCH_ITERATIONS:
                    # Refine query slightly
                    current_query = generate_search_query(llm, messages + [{"role": "assistant", "content": f"Pencarian '{current_query}' gagal. Buat keyword pencarian yang berbeda."}], memories)
                else:
                    break
                    
        # 3. Synthesize Answer
        if not search_results:
            final_content = "Maaf, saya tidak dapat menemukan informasi yang cukup mengenai hal tersebut saat ini."
        else:
            final_content = synthesize_answer(llm, messages, memories, search_results, sources)
            
        return {
            "messages": messages + [{"role": "assistant", "content": final_content}],
            "current_skill": "research",
            "sources": sources
        }
        
    except Exception as e:
        print(f"Error in research_node: {e}")
        return {"messages": messages + [{"role": "assistant", "content": "Maaf, layanan riset sedang mengalami gangguan."}], "current_skill": "research"}
