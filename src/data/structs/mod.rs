pub mod api;

use serde::{Serialize, Deserialize};

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
}

#[derive(Deserialize, Clone)]
pub struct User {
    pub name: String,
    pub password: String,
}

impl User {
    pub fn verify(self) -> Result<(), String> {
        if self.name.contains(':') {
            Err(String::from("Username cannot contains a `:` symbol!"))
        } else if self.password.contains(':') {
            Err(String::from("Password cannot contains a `:` symbol!"))
        } else {
            Ok(())
        }
    }
}

#[derive(Deserialize, Clone)]
pub struct Config {
    pub users: Vec<User>,
    pub addr: String,
    pub port: u16,
}
