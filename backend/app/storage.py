from collections import OrderedDict
from typing import List, Optional

from .models import ProjectAnalysisResponse, ProjectSummary

MAX_STORED_PROJECTS = 25


class InMemoryProjectStore:
    """Thread-safe in-memory store for analyzed projects during the session."""

    def __init__(self) -> None:
        self._projects: "OrderedDict[str, ProjectAnalysisResponse]" = OrderedDict()

    def save(self, analysis: ProjectAnalysisResponse) -> None:
        pid = analysis.summary.project_id
        if pid in self._projects:
            self._projects.move_to_end(pid)
        self._projects[pid] = analysis
        while len(self._projects) > MAX_STORED_PROJECTS:
            self._projects.popitem(last=False)

    def get(self, project_id: str) -> Optional[ProjectAnalysisResponse]:
        return self._projects.get(project_id)

    def list_recent(self) -> List[ProjectSummary]:
        return [proj.summary for proj in reversed(list(self._projects.values()))]

    def count(self) -> int:
        return len(self._projects)

    def clear(self) -> None:
        self._projects.clear()


project_store = InMemoryProjectStore()
