use serde::{Serialize, Deserialize};

#[derive(Serialize)]
pub struct OkResponse {
    pub ok: bool,
}

#[derive(Serialize)]
pub struct OkWithMessageResponse {
    pub ok: bool,
    pub message: String,
}

#[derive(Deserialize)]
pub struct CreateProjectRequest {
    pub name: String,
}

#[derive(Deserialize)]
pub struct PushMetricsRequest {
    pub project_name: String,
    pub run_name: String,
    pub metrics: serde_json::Value,
}

#[derive(Deserialize)]
pub struct GetRunRequest {
    pub project_name: String,
    pub run_name: String,
}

#[derive(Serialize)]
pub struct GetMetricsResponse {
    pub ok: bool,
    pub metrics: Vec<serde_json::Value>,
}

#[derive(Deserialize)]
pub struct GetRunsRequest {
    pub project_name: String,
}

#[derive(Serialize)]
pub struct Project {
    pub name: String,
    pub modified_at: u64,
}

#[derive(Serialize)]
pub struct GetProjectsResponse {
    pub ok: bool,
    pub projects: Vec<Project>,
}

#[derive(Serialize)]
pub struct GetRunsResponse {
    pub ok: bool,
    pub runs: Vec<Project>,
}
