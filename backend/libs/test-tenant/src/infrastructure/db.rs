use std::{env, fs, path::Path};

use deadpool_diesel::sqlite::{Manager, Pool, Runtime};
use dotenvy::dotenv;

const DEFAULT_DATABASE_URL: &str = "file:./data/test-tenant.db";

pub fn create_connection_pool() -> Pool {
    dotenv().ok();
    let database_url = env::var("TEST_TENANT_DATABASE_URL")
        .unwrap_or_else(|_| DEFAULT_DATABASE_URL.to_string());
    tracing::info!(
        "Creating test-tenant connection pool to database at {}",
        database_url
    );
    create_connection_pool_from_url(&database_url)
}

pub fn create_connection_pool_from_url(database_url: &str) -> Pool {
    ensure_sqlite_parent_dir_exists(database_url);
    let mgr = Manager::new(database_url.to_string(), Runtime::Tokio1);
    Pool::builder(mgr)
        .max_size(16)
        .build()
        .expect("Failed to create test-tenant pool.")
}

fn ensure_sqlite_parent_dir_exists(database_url: &str) {
    if is_in_memory_sqlite(database_url) {
        return;
    }

    let path_str = if let Some(file_uri_path) = database_url.strip_prefix("file:") {
        file_uri_path.split('?').next().unwrap_or(file_uri_path)
    } else {
        database_url
    };

    let path = Path::new(path_str);
    let Some(parent) = path.parent() else {
        return;
    };
    if parent.as_os_str().is_empty() {
        return;
    }

    fs::create_dir_all(parent).unwrap_or_else(|err| {
        panic!(
            "Failed to create SQLite parent directory '{}': {}",
            parent.display(),
            err
        )
    });
}

fn is_in_memory_sqlite(database_url: &str) -> bool {
    database_url == ":memory:"
        || database_url.starts_with("file::memory:")
        || database_url.starts_with("file:?mode=memory")
        || database_url.starts_with("file:") && database_url.contains("mode=memory")
}
