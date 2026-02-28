from langchain.messages import SystemMessage, ToolMessage


def make_llm_call(model):
    """Returns an llm_call node that uses the given model."""
    def llm_call(state: dict):
        """LLM decides whether to call a tool or not"""
        return {
            "messages": [
                model.invoke(
                    [
                        SystemMessage(
                            content="You are a helpful assistant who is tasked with looking at a codebase and discovering bugs and offering solutions." \
                            "You have access to a tool that can search this codebase. Use this tool to search the codebase for the error and then provide the solution."
                        )
                    ]
                    + state["messages"]
                )
            ],
            "llm_calls": state.get('llm_calls', 0) + 1
        }
    return llm_call


def make_tool_node(tools):
    """Returns a tool_node that uses the given list of tools."""
    tools_by_name = {t.name: t for t in tools}

    def tool_node(state: dict):
        """Performs the tool call"""
        result = []
        for tool_call in state["messages"][-1].tool_calls:
            tool = tools_by_name[tool_call["name"]]
            observation = tool.invoke(tool_call["args"])
            result.append(ToolMessage(content=observation, tool_call_id=tool_call["id"]))
        return {"messages": result}
    return tool_node
