pub mod handlers;
pub mod database;
pub mod data;

use std::process::ExitCode;

use tokio::fs;

#[tokio::main]
async fn main() -> ExitCode {
    let config_file_is_exists = tokio::fs::try_exists("config.yml").await;

    if config_file_is_exists.is_err() || !config_file_is_exists.unwrap() {
        eprintln!("Please, create and fill a config file `config.yml`. Example config: `config.yml.example`!");

        return ExitCode::from(1);
    }

    let config = match fs::read_to_string("config.yml").await {
        Ok(c) => {
            match serde_yaml::from_str::<data::structs::Config>(&c) {
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

    ExitCode::from(0)
}
