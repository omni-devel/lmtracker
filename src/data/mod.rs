pub mod structs;

use rand::{distr::Alphanumeric, Rng, rng};
use uuid::Uuid;

pub static INVALID_NAME_CHARS: [char; 10] = ['\\', '/', ':', '*', '?', '"', '<', '>', '|', '\0'];

pub fn generate_random_string(len: u16) -> String {
    rng()
        .sample_iter(&Alphanumeric)
        .take(len as usize)
        .map(char::from)
        .collect()
}

pub fn generate_uuid() -> String {
    Uuid::new_v4().to_string()
}
