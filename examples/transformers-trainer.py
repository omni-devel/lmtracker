from transformers import Trainer, TrainerCallback

import datetime

import requests


class LMTracker(TrainerCallback):
    def __init__(
        self,
        project_name: str,
        run_name: str,
        username: str,
        password: str,
        base_url: str = "http://localhost:8683/api",
    ) -> None:
        self.base_url = base_url.rstrip('/')
        self.project_name = project_name
        self.run_name = run_name
        self.username = username
        self.password = password
        self._create_project()

    @property
    def _headers(self):
        return {
            "Authorization": f"{self.username}:{self.password}",
            "Content-Type": "application/json"
        }

    def _post(self, path: str, json_data: dict | None = None):
        url = f"{self.base_url}/{path.lstrip('/')}"
        response = requests.post(url, json=json_data, headers=self._headers, timeout=10)
        response.raise_for_status()
        return response

    def _create_project(self):
        return self._post("create-project", json_data={"name": self.project_name})

    def on_log(self, args, state, control, **kwargs):
        logs = kwargs.get("logs")
        if logs is None or not logs:
            return
        metrics = {}
        for key, value in logs.items():
            if isinstance(value, (int, float)):
                if isinstance(value, float) and (value != value or value == float('inf') or value == float('-inf')):
                    continue
                metrics[key] = value
            elif isinstance(value, str):
                try:
                    fval = float(value)
                    if fval != fval or fval == float('inf') or fval == float('-inf'):
                        continue
                    metrics[key] = fval
                except ValueError:
                    continue
        if not metrics:
            return
        payload = {
            "project_name": self.project_name,
            "run_name": self.run_name,
            "step": state.global_step,
            "epoch": state.epoch,
            "metrics": metrics,
        }
        try:
            self._post("push-metrics", json_data=payload)
        except Exception as e:
            print(e)


tracker = LMTracker(
    project_name="Test project 123",
    run_name=datetime.datetime.now().strftime("%d-%m-%Y %H:%M:%S"),
    username="omni-devel",
    password="12345",
    base_url="http://localhost:8683/api",
)

trainer = Trainer(
    ...,
    callbacks=[tracker]
)
