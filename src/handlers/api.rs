use actix_web::{get, post, HttpRequest, HttpResponse, web};

use crate::data::structs::{
    self,
    api as api_json, AppState,
    User,
};
use serde_json::json;

use crate::database;

fn check_auth(req: HttpRequest, config: &structs::Config) -> Option<User> {
    let auth_data = match req.headers().get("Authorization") {
        Some(d) => {
            let data: Vec<String> = d.to_str().unwrap().split(':').map(|s| s.to_string()).collect();

            if data.len() != 2 {
                return None;
            }

            User {
                name: data.get(0).unwrap().to_string(),
                password: data.get(1).unwrap().to_string(),
            }
        },
        None => {
            return None;
        }
    };

    let user_is_finded = config.users.iter().any(|user| user.name == auth_data.name && user.password == auth_data.password);

    if !user_is_finded {
        return None;
    }

    Some(auth_data)
}

#[post("/api/create-project")]
pub async fn create_project(req: HttpRequest, data: web::Json<api_json::CreateProjectRequest>, state: web::Data<AppState>) -> HttpResponse {
    let auth_data = match check_auth(req, &state.config) {
        Some(d) => d,
        None => {
            return HttpResponse::Unauthorized()
                .json(api_json::OkResponse {
                    ok: false,
                });
        }
    };

    database::create_project(&auth_data.name, &data.name).await;

    HttpResponse::Ok()
        .json(api_json::OkResponse {
            ok: true,
        })
}

#[post("/api/add-metrics")]
pub async fn add_metrics(req: HttpRequest, data: web::Json<api_json::AddMetricsRequest>, state: web::Data<AppState>) -> HttpResponse {
    let auth_data = match check_auth(req, &state.config) {
        Some(d) => d,
        None => {
            return HttpResponse::Unauthorized()
                .json(api_json::OkResponse {
                    ok: false,
                });
        }
    };

    match database::write_metrics(&auth_data.name, &data.project_name, &data.metrics).await {
        Ok(()) => {
            HttpResponse::Ok()
                .json(api_json::OkResponse {
                    ok: true,
                })
        },
        Err(e) => {
            HttpResponse::BadRequest()
                .json(api_json::OkWithMessageResponse {
                    ok: false,
                    message: e,
                })
        }
    }
}
