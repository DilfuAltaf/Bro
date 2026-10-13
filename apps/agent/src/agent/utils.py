from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

def build_prompt(messages, system_prompt, memories=None):
    if memories:
        memory_context = "\n\nUser Memories:\n" + "\n".join([f"- {m['type'].upper()}: {m['content']}" for m in memories])
        system_prompt += memory_context

    langchain_messages = [SystemMessage(content=system_prompt)]
    for msg in messages:
        if msg.get('role') == 'user':
            langchain_messages.append(HumanMessage(content=msg.get('content', '')))
        else:
            langchain_messages.append(AIMessage(content=msg.get('content', '')))
    return langchain_messages
