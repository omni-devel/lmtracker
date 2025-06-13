# LMTracker

A simple and efficient local service for tracking metrics, written in Rust.

---

## Requirements

- [Rust](https://rustup.rs/)

---

## Setup & Usage

1. **Copy the sample config:**
   ```sh
   cp config.yml.sample config.yml
   ```
2. **Edit your configuration:**
   ```sh
   nano config.yml
   ```
   Replace all parameters with your own values.

3. **Build and run the service:**
   ```sh
   cargo run --release
   ```

---

## API Overview

### Authorization

All requests require the following header:
```
Authorization: user-name:password
```

---

### Endpoints

#### `POST /api/create-project`

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

---

#### `POST /api/push-metrics`

**Request JSON:**
```json
{
  "project_name": "String",
  "run_name": "String",
  "metrics": { /* Object */ }
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

---

#### `POST /api/get-run`

**Request JSON:**
```json
{
  "project_name": "String",
  "run_name": "String"
}
```
**Response:**
```json
{ "ok": true, "metrics": [ /* Object */ ] }
```
or
```json
{ "ok": true, "message": "String" }
```
or
```json
{ "ok": true }
```

---

#### `POST /api/get-projects`

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

---

#### `POST /api/get-runs`

**Request JSON:**  
_No parameters required._

**Response:**
```json
{ "ok": true, "runs": [ { "name": "String", "modified_at": 1234567890 } ] }
```
or
```json
{ "ok": true, "metrics": [ /* Object */ ] }
```
or
```json
{ "ok": true, "message": "String" }
```
or
```json
{ "ok": true }
```

---

#### `GET /api/check-user`

**Request JSON:**  
_No parameters required._

**Response:**
```json
{ "ok": true }
```

---

> _Track your metrics like a pro. No cloud, no nonsense, just Rusty speed!_
