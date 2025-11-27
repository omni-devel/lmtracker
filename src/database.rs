use tokio::{
    fs,
    io::{self, AsyncBufReadExt, AsyncWriteExt},
};

use crate::data::structs::{User, api::Project, same_json_schema};

pub async fn init(users: &Vec<User>) {
    let _ = fs::create_dir("./database").await;

    for user in users {
        create_user(&user.name).await;
    }
}

pub async fn create_user(name: &String) {
    let _ = fs::create_dir(format!("./database/{}", name)).await;
}

pub async fn create_project(user_name: &String, project_name: &String) {
    let _ = fs::create_dir(format!("./database/{}/{}", user_name, project_name)).await;
}

pub async fn delete_project(user_name: &String, project_name: &String) {
    let _ = fs::remove_dir(format!("./database/{}/{}", user_name, project_name)).await;
}

pub async fn delete_run(user_name: &String, project_name: &String, run_name: &String) {
    let _ = fs::remove_file(format!(
        "./database/{}/{}/{}.jsonl",
        user_name, project_name, run_name
    ))
    .await;
}

pub async fn write_metrics(
    user_name: &String,
    project_name: &String,
    run_name: &String,
    metrics: &serde_json::Value,
) -> Result<(), String> {
    let project_path = format!(
        "./database/{}/{}/{}.jsonl",
        user_name, project_name, run_name
    );

    let file_exists = fs::metadata(&project_path).await.is_ok();

    if file_exists {
        let mut file = fs::File::open(&project_path)
            .await
            .map_err(|e| e.to_string())?;
        let mut reader = io::BufReader::new(&mut file).lines();

        if let Some(line) = reader.next_line().await.map_err(|e| e.to_string())? {
            let first_line_metrics =
                serde_json::from_str::<serde_json::Value>(&line).map_err(|e| e.to_string())?;

            if !same_json_schema(&first_line_metrics, metrics) {
                return Err(String::from("Invalid schema"));
            }
        }
    }

    let mut file = fs::OpenOptions::new()
        .append(true)
        .create(true)
        .open(&project_path)
        .await
        .map_err(|e| e.to_string())?;

    file.write_all(serde_json::to_string(metrics).unwrap().as_bytes())
        .await
        .map_err(|e| e.to_string())?;
    file.write_all(b"\n").await.map_err(|e| e.to_string())?;

    Ok(())
}

pub async fn read_metrics(
    user_name: &String,
    project_name: &String,
    run_name: &String,
) -> Result<Vec<serde_json::Value>, String> {
    let project_path = format!(
        "./database/{}/{}/{}.jsonl",
        user_name, project_name, run_name
    );

    let file_exists = fs::metadata(&project_path).await.is_ok();

    let mut result: Vec<serde_json::Value> = Vec::new();

    if file_exists {
        let mut file = fs::File::open(&project_path)
            .await
            .map_err(|e| e.to_string())?;
        let mut reader = io::BufReader::new(&mut file).lines();

        while let Some(line) = reader.next_line().await.map_err(|e| e.to_string())? {
            if line.trim().is_empty() {
                continue;
            }

            let metrics =
                serde_json::from_str::<serde_json::Value>(&line).map_err(|e| e.to_string())?;

            result.push(metrics);
        }

        Ok(result)
    } else {
        Err(String::from("Run not found"))
    }
}

pub async fn get_projects(user_name: &String) -> Vec<Project> {
    let projects_path = format!("./database/{}", user_name);

    let mut result: Vec<Project> = Vec::new();

    let mut dirs = fs::read_dir(&projects_path).await.unwrap();

    while let Some(dir) = dirs.next_entry().await.unwrap() {
        result.push(Project {
            name: dir
                .path()
                .display()
                .to_string()
                .split('/')
                .collect::<Vec<&str>>()
                .last()
                .unwrap()
                .to_string(),
            modified_at: dir
                .metadata()
                .await
                .unwrap()
                .modified()
                .unwrap()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        });
    }

    result.sort_by(|a, b| a.modified_at.cmp(&b.modified_at));

    result
}

pub async fn get_runs(user_name: &String, project_name: &String) -> Result<Vec<Project>, String> {
    let projects_path = format!("./database/{}/{}", user_name, project_name);

    let mut result: Vec<Project> = Vec::new();

    let mut dirs = fs::read_dir(&projects_path)
        .await
        .map_err(|e| e.to_string())?;

    while let Some(dir) = dirs.next_entry().await.unwrap() {
        let path = dir.path();
        if path.is_file() {
            if let Some(extension) = path.extension() {
                if extension == "jsonl" {
                    if let Some(file_stem) = path.file_stem() {
                        result.push(Project {
                            name: file_stem.to_string_lossy().into_owned(),
                            modified_at: dir
                                .metadata()
                                .await
                                .unwrap()
                                .modified()
                                .unwrap()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap()
                                .as_secs(),
                        });
                    }
                }
            }
        }
    }

    result.sort_by(|a, b| a.modified_at.cmp(&b.modified_at));

    Ok(result)
}
