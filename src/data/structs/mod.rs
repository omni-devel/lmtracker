pub mod api;

use serde::Deserialize;

pub fn same_json_schema(a: &serde_json::Value, b: &serde_json::Value) -> bool {
    use serde_json::Value;

    match (a, b) {
        (Value::Object(map_a), Value::Object(map_b)) => {
            if map_a.len() != map_b.len() || !map_a.keys().all(|k| map_b.contains_key(k)) {
                return false;
            }

            map_a.keys().all(|k| same_json_schema(&map_a[k], &map_b[k]))
        }
        (Value::Array(arr_a), Value::Array(arr_b)) => {
            match (arr_a.get(0), arr_b.get(0)) {
                (Some(first_a), Some(first_b)) => same_json_schema(first_a, first_b),
                _ => true,
            }
        }
        (Value::String(_), Value::String(_)) => true,
        (Value::Number(_), Value::Number(_)) => true,
        (Value::Bool(_), Value::Bool(_)) => true,
        (Value::Null, Value::Null) => true,
        _ => false,
    }
}

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
