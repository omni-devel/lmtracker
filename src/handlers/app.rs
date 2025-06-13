use actix_web::{get, HttpRequest, HttpResponse, web};

use tokio::fs;

use crate::data::{structs, structs::api as api_json};

#[get("/")]
pub async fn index() -> HttpResponse {
    HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(fs::read_to_string("html/index.html").await.unwrap())
}
