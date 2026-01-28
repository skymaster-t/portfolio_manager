from crewai_tools import BaseTool
from app.scripts.sample_analysis import calculate_net_worth

class NetWorthTool(BaseTool):
    name: str = "Net Worth Calculator"
    description: str = "Calculates net worth from assets and liabilities."

    def _run(self, assets: float, liabilities: float) -> float:
        return calculate_net_worth(assets, liabilities)