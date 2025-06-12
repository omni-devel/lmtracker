use tokio::fs;

pub async fn init() {
    let _ = fs::create_dir("./database").await;
}
