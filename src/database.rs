use tokio::{fs, io::{self, AsyncBufReadExt, AsyncWriteExt}};

use crate::data::structs::{User, same_json_schema};

pub async fn init(users: &Vec<User>) {
    let _ = fs::create_dir("./database").await;

    for user in users {
        create_user(&user.name).await;
    }
}

pub async fn create_user(name: &String) {
    let _ = fs::create_dir(
        format!("./database/{}", name)
    ).await;
}

pub async fn create_project(user_name: &String, project_name: &String) {
    let _ = fs::write(
        format!("./database/{}/{}.jsonl", user_name, project_name),
        String::new(),
    );
}

pub async fn write_metrics(user_name: &String, project_name: &String, metrics: &serde_json::Value) -> Result<(), String> {
    let project_path = format!("./database/{}/{}.jsonl", user_name, project_name);

    let mut file = fs::File::options().append(true).open(&project_path).await.unwrap();
    let mut reader = io::BufReader::new(&mut file).lines();

    if let Some(line) = reader.next_line().await.unwrap() {
        let first_line_metrics = match serde_json::from_str::<serde_json::Value>(&line) {
            Ok(m) => m,
            Err(e) => {
                return Err(e.to_string());
            },
        };

        if !same_json_schema(&first_line_metrics, metrics) {
            return Err(String::from("Invalid schema"));
        }
    }

    file.write(serde_json::to_string(metrics).unwrap().as_bytes()).await.unwrap();
    file.write("\n".as_bytes()).await.unwrap();

    Ok(())
}
