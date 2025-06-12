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
pub struct AddMetricsRequest {
    pub project_name: String,
    pub metrics: serde_json::Value,
}
