pub mod api;

use serde::{Serialize, Deserialize};

#[derive(Deserialize)]
pub struct User {
    pub username: String,
    pub password: String,
}

#[derive(Deserialize)]
pub struct Config {
    users: Vec<User>,
}
