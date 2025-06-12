pub mod api;

use serde::{Serialize, Deserialize};

#[derive(Deserialize)]
pub struct User {
    pub username: String,
    pub password: String,
}

impl User {
    pub fn verify(self) -> Result<(), String> {
        if self.username.contains(':') {
            Err(String::from("Username cannot contains a `:` symbol!"))
        } else if self.password.contains(':') {
            Err(String::from("Password cannot contains a `:` symbol!"))
        } else {
            Ok(())
        }
    }
}

#[derive(Deserialize)]
pub struct Config {
    users: Vec<User>,
}
