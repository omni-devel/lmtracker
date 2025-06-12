use actix_web::{get, post, HttpRequest, HttpResponse, web};

use crate::data::{structs, structs::api as api_json};
use serde_json::json;

#[post("/api/create-project")]
pub async fn create_project(req: HttpRequest, data: web::Json<api_json::CreateProjectRequest>) -> HttpResponse {
    let auth_data = match req.headers().get("Authorization") {
        Some(d) => {
            let data: Vec<String> = d.to_str().unwrap().split(':').map(|s| s.to_string()).collect();

            if data.len() != 2 {
                return HttpResponse::Unauthorized()
                    .json(api_json::OkResponse {
                        ok: false,
                    });
            }

            structs::User {
                username: data.get(0).unwrap().to_string(),
                password: data.get(1).unwrap().to_string(),
            }
        },
        None => {
            return HttpResponse::Unauthorized()
                .json(api_json::OkResponse {
                    ok: false,
                });
        }
    };

    HttpResponse::Ok()
        .json(api_json::OkResponse {
            ok: true,
        })
}
