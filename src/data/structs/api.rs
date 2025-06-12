use serde::{Serialize, Deserialize};

#[derive(Serialize)]
pub struct OkResponse {
    pub ok: bool,
}

#[derive(Deserialize)]
pub struct CreateProjectRequest {
    pub name: String,
}
