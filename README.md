# LMTracker 🚀

A simple and efficient local service for tracking metrics, written in Rust.
No cloud, no nonsense, just blazing-fast, **local-first** metrics tracking.

---

## ✨ How it Works

LMTracker is designed for developers who want to track their ML experiment metrics without relying on external cloud services. It's built for speed and simplicity, keeping all your precious data right on your machine.

### 🛠️ Tech Stack:

*   **Backend:** Rust (super fast and safe!)
    *   **Web Framework:** `actix-web` for handling API requests.
    *   **Asynchronous Runtime:** `tokio` for non-blocking operations.
*   **Frontend:** Standard web technologies (HTML, CSS, JavaScript)
    *   **UI Framework:** Bootstrap 5 for responsive design.
    *   **Charting Library:** Chart.js for beautiful, interactive metric visualizations.

### 🗄️ Data Storage:

All your project and run data is stored locally in a `database` folder. Each run's metrics are saved as `jsonl` (JSON Lines) files, making them easily readable and extendable. The schema of your metrics is checked on the first push to ensure consistency across your runs within a project.

---

## 🚀 Setup & Usage

**Build and run the service:**
```sh
cargo run --release
```
This will start the LMTracker server, usually on `http://localhost:8683` (or whatever address/port you configured).
On first launch, you will be prompted to create a configuration file. When creating the configuration file, the number of users you specify will be generated, each with a random username and a secure password.

---

## 🔌 API Overview

All requests require an `Authorization` header in the format `username:password`.

**Authorization Header Example:**
```
Authorization: your-username:your-password
```

### Endpoints:

#### `POST /api/create-project`
Creates a new project.
**Request JSON:**
```json
{
  "name": "String"
}
```
**Response:**
```json
{ "ok": true }
```

#### `POST /api/push-metrics`
Pushes metrics for a specific run within a project. If the run doesn't exist, it will be created. Schema consistency is checked on the first metric push.
**Request JSON:**
```json
{
  "project_name": "String",
  "run_name": "String",
  "metrics": { /* Object (e.g., {"loss": 0.1, "accuracy": 0.95}) */ }
}
```
**Response:**
```json
{ "ok": true, "message": "String" }
```
or
```json
{ "ok": true }
```

#### `POST /api/get-run`
Retrieves all logged metrics for a specific run.
**Request JSON:**
```json
{
  "project_name": "String",
  "run_name": "String"
}
```
**Response:**
```json
{ "ok": true, "metrics": [ /* Array of metric objects */ ] }
```
or
```json
{ "ok": true, "message": "String" }
```
or
```json
{ "ok": true }
```

#### `POST /api/delete-run`
Deletes a specific run and all its associated metrics data. **This action is irreversible!**
**Request JSON:**
```json
{
  "project_name": "String",
  "run_name": "String"
}
```
**Response:**
```json
{ "ok": true, "message": "String" }
```
or
```json
{ "ok": true }
```

#### `POST /api/get-projects`
Lists all projects created by the authenticated user.
**Request JSON:**
_No parameters required._

**Response:**
```json
{ "ok": true, "projects": [ { "name": "String", "modified_at": 1234567890 } ] }
```
or
```json
{ "ok": true, "message": "String" }
```
or
```json
{ "ok": true }
```

#### `POST /api/get-runs`
Lists all runs within a specific project.
**Request JSON:**
```json
{
  "project_name": "String"
}
```
**Response:**
```json
{ "ok": true, "runs": [ { "name": "String", "modified_at": 1234567890 } ] }
```
or
```json
{ "ok": true, "message": "String" }
```
or
```json
{ "ok": true }
```

#### `GET /api/check-user`
Checks if the provided authentication credentials are valid.
**Request JSON:**
_No parameters required._

**Response:**
```json
{ "ok": true }
```

---

## 💡 Examples

Check out the `examples/` directory for practical implementations:

*   `examples/transformers-trainer.py`
    This script demonstrates how to integrate LMTracker with Hugging Face's `transformers.Trainer`. It provides a custom `LMTracker` callback that automatically pushes training and evaluation metrics from your `Trainer` to your local LMTracker service.

    **How to use:**
    1.  Copy the `LMTracker` class into your project.
    2.  Initialize `LMTracker` with your project details, username, password, and the `base_url` of your running LMTracker instance.
    3.  Pass the `tracker` instance to the `callbacks` argument of your `Trainer`.

    ```python
    from transformers import Trainer
    import datetime

    # Assuming LMTracker class is imported or defined
    # from your_module import LMTracker

    tracker = LMTracker(
        project_name="MyAwesomeModel",
        run_name=datetime.datetime.now().strftime("%Y-%m-%d-%H-%M-%S"),
        username="your-username",
        password="your-password",
        base_url="http://localhost:8683/api",
    )

    trainer = Trainer(
        # your model, args, data, etc.
        callbacks=[tracker]
    )

    trainer.train()
    ```
