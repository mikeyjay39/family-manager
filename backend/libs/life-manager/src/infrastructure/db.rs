use std::{env, fs, path::Path};

use deadpool_diesel::sqlite::{Manager, Pool, Runtime};
use diesel_migrations::{EmbeddedMigrations, MigrationHarness, embed_migrations};
use dotenvy::dotenv;

pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations/");

pub fn create_connection_pool() -> Pool {
    dotenv().ok();
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    tracing::info!("Creating connection pool to database at {}", database_url);
    create_connection_pool_from_url(&database_url)
}

pub fn create_connection_pool_from_url(database_url: &str) -> Pool {
    ensure_sqlite_parent_dir_exists(database_url);
    let mgr = Manager::new(database_url.to_string(), Runtime::Tokio1);
    Pool::builder(mgr)
        .max_size(16)
        .build()
        .expect("Failed to create pool.")
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

pub async fn run_migrations(pool: &Pool) {
    let conn = pool.get().await.expect("Failed to get DB connection");
    conn.interact(|conn_inner| conn_inner.run_pending_migrations(MIGRATIONS).map(|_| ()))
        .await
        .expect("Failed to run life-manager migrations interact")
        .expect("Failed to run pending life-manager migrations");
}

#[cfg(test)]
mod migration_tests {
    use std::sync::Arc;

    use diesel::RunQueryDsl;
    use uuid::Uuid;

    use crate::application::document_repository::DocumentRepository;
    use crate::infrastructure::document::document_orm_collection::DocumentOrmCollection;

    use super::*;

    #[tokio::test]
    async fn run_migrations_applies_created_at_to_legacy_schema() {
        let dir = tempfile::tempdir().unwrap();
        let db_url = format!("file:{}/legacy.db", dir.path().display());
        let pool = Arc::new(create_connection_pool_from_url(&db_url));

        run_migrations(pool.as_ref()).await;

        let conn = pool.get().await.expect("pool connection");
        conn.interact(|conn| -> Result<(), diesel::result::Error> {
            diesel::sql_query(
                "DELETE FROM __diesel_schema_migrations WHERE version = '20260711000000'",
            )
            .execute(conn)?;
            diesel::sql_query("ALTER TABLE documents DROP COLUMN expire_date").execute(conn)?;
            diesel::sql_query("ALTER TABLE documents DROP COLUMN issued_date").execute(conn)?;
            diesel::sql_query("ALTER TABLE documents DROP COLUMN created_at").execute(conn)?;
            diesel::sql_query(
                "INSERT INTO documents (id, title, content, user_id) VALUES ('00000000-0000-0000-0000-0000000000aa', 'legacy', 'content', '00000000-0000-0000-0000-000000000001')",
            )
            .execute(conn)?;
            Ok(())
        })
        .await
        .expect("legacy downgrade interact")
        .expect("legacy downgrade");

        let repo = DocumentOrmCollection::new(pool.clone());
        let user_id = Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap();
        assert!(
            repo.get_documents(&user_id, &100).await.is_empty(),
            "legacy schema should return no documents before migration"
        );

        run_migrations(pool.as_ref()).await;

        let docs = repo.get_documents(&user_id, &100).await;
        assert_eq!(docs.len(), 1, "documents should load after migration");
        assert_eq!(docs[0].title, "legacy");
    }
}
