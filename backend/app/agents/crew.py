from crewai import Agent, Task, Crew
from langchain_xai import ChatXAI
from app.tools.analysis_tools import NetWorthTool

llm = ChatXAI(model="grok-beta", api_key=os.getenv("XAI_API_KEY"))

# Example agent that uses custom tool
analyst_agent = Agent(
    role="Financial Analyst",
    goal="Perform accurate calculations using custom tools",
    backstory="Expert in personal finance",
    tools=[NetWorthTool()],
    llm=llm,
    verbose=True
)

master_agent = Agent(
    role="Master Coordinator",
    goal="Assemble and summarize results from specialist agents",
    backstory="Senior financial advisor",
    llm=llm,
    verbose=True
)

# Example task
task = Task(
    description="Calculate net worth for assets=100000, liabilities=50000 and explain.",
    expected_output="Net worth value and brief explanation",
    agent=analyst_agent
)

crew = Crew(
    agents=[analyst_agent, master_agent],
    tasks=[task],
    verbose=2
)

# To test later: result = crew.kickoff()