use actix_web::{get, HttpRequest, HttpResponse, web};

use tokio::fs;

use crate::data::{structs, structs::api as api_json};

#[get("/")]
pub async fn index() -> HttpResponse {
    HttpResponse::Ok()
        .content_type("text/html; charset=utf-8")
        .body(fs::read_to_string("html/index.html").await.unwrap())
}

#[get("/styles.css")]
pub async fn styles() -> HttpResponse {
    HttpResponse::Ok()
        .content_type("text/css; charset=utf-8")
        .body(fs::read_to_string("html/styles.css").await.unwrap())
}

#[get("/scripts.js")]
pub async fn scripts() -> HttpResponse {
    HttpResponse::Ok()
        .content_type("application/javascript; charset=utf-8")
        .body(fs::read_to_string("html/scripts.js").await.unwrap())
}
