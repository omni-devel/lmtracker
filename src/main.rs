pub mod handlers;
pub mod database;
pub mod data;

use data::structs::{AppState, Config, User};

use std::{io::Write, process::ExitCode};

use tokio::fs;
use std::io;

use actix_web::{App, web, HttpServer};

#[tokio::main]
async fn main() -> ExitCode {
    let config_file_is_exists = tokio::fs::try_exists("config.yml").await;

    if config_file_is_exists.is_err() || !config_file_is_exists.unwrap() {
        print!("Do you want to create a completed configuration file? y/[n]: ");
        io::stdout().flush().unwrap();

        let mut buffer = String::new();
        io::stdin().read_line(&mut buffer).unwrap();

        if buffer.to_lowercase().trim() == String::from("y") {
            loop {
                print!("How many users do you want to create? [1..=100]: ");
                io::stdout().flush().unwrap();

                buffer.clear();
                io::stdin().read_line(&mut buffer).unwrap();

                let users_count = match buffer.trim().parse::<u16>() {
                    Ok(count) => {
                        if count >= 1 && count <= 100 {
                            count
                        } else {
                            eprintln!("Incorrect value! Enter a number from 1 to 100.");

                            continue;
                        }
                    },
                    Err(e) => {
                        eprintln!("Incorrect value: {}", e);

                        continue;
                    }
                };

                let mut config = Config::default();

                for i in 0..users_count {
                    let name = data::generate_random_string(6);
                    let password = data::generate_uuid();

                    println!("--- Credentials for user {} ---", i + 1);
                    println!("name: {}", name);
                    println!("password: {}", password);

                    config.users.push(User {
                        name,
                        password,
                    });
                }

                fs::write("config.yml", serde_yaml::to_string(&config).unwrap()).await.unwrap();

                break;
            }
        } else {
            eprintln!("Please, create and fill a config file `config.yml`. Example config: `config.yml.sample`!");

            return ExitCode::from(1);
        }
    }

    let config = match fs::read_to_string("config.yml").await {
        Ok(c) => {
            match serde_yaml::from_str::<Config>(&c) {
                Ok(config) => {
                    for user in config.users.iter() {
                        match user.clone().verify() {
                            Ok(_) => { },
                            Err(e) => {
                                eprintln!("User `{}` error: {}. Please, fix the `config.yml` file", user.name, e);

                                return ExitCode::from(1);
                            }
                        };
                    }

                    config
                },
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
            .service(handlers::api::delete_run)
    }).bind((addr, port)).unwrap().run().await.unwrap();
}
