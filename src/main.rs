pub mod handlers;
pub mod database;
pub mod data;

use data::structs::{AppState, Config};

use std::process::ExitCode;

use tokio::fs;

use actix_web::{App, web, HttpServer};

#[tokio::main]
async fn main() -> ExitCode {
    let config_file_is_exists = tokio::fs::try_exists("config.yml").await;

    if config_file_is_exists.is_err() || !config_file_is_exists.unwrap() {
        eprintln!("Please, create and fill a config file `config.yml`. Example config: `config.yml.sample`!");

        return ExitCode::from(1);
    }

    let config = match fs::read_to_string("config.yml").await {
        Ok(c) => {
            match serde_yaml::from_str::<Config>(&c) {
                Ok(config) => config,
                Err(_) => {
                    eprintln!("Incorrect `config.yml` config file!");

                    return ExitCode::from(1);
                }
            }
        },
        Err(_) => {
            eprintln!("Incorrect `config.yml` config file!");

            return ExitCode::from(1);
        }
    };

    database::init(&config.users).await;

    run_web_server(config).await;

    ExitCode::from(0)
}

async fn run_web_server(config: Config) {
    let addr = config.addr.clone();
    let port = config.port;
    let config_data = web::Data::new(AppState { config });

    println!("Running LMTracker server on {}:{}", addr, port);

    HttpServer::new(move || {
        App::new()
            .app_data(config_data.clone())
            .service(handlers::app::index)
            .service(handlers::app::styles)
            .service(handlers::app::scripts)
            .service(handlers::api::create_project)
            .service(handlers::api::push_metrics)
            .service(handlers::api::get_run)
            .service(handlers::api::get_projects)
            .service(handlers::api::get_runs)
            .service(handlers::api::check_user)
    }).bind((addr, port)).unwrap().run().await.unwrap();
}
