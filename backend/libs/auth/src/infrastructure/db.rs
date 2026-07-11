use deadpool_diesel::sqlite::Pool;
use diesel_migrations::{EmbeddedMigrations, MigrationHarness, embed_migrations};

const MIGRATIONS: EmbeddedMigrations = embed_migrations!("migrations/");

pub async fn run_migrations(pool: &Pool) {
    let conn = pool.get().await.expect("Failed to get DB connection");
    conn.interact(|conn_inner| conn_inner.run_pending_migrations(MIGRATIONS).map(|_| ()))
        .await
        .expect("Failed to run auth migrations interact")
        .expect("Failed to run pending auth migrations");
}

#[cfg(test)]
pub fn fresh_test_pool() -> std::sync::Arc<Pool> {
    use deadpool_diesel::sqlite::{Manager, Runtime};
    use std::sync::Arc;

    let mgr = Manager::new(":memory:".to_string(), Runtime::Tokio1);
    Arc::new(Pool::builder(mgr).max_size(1).build().unwrap())
}

#[cfg(test)]
pub fn test_pool() -> std::sync::Arc<Pool> {
    use std::sync::OnceLock;

    static POOL: OnceLock<std::sync::Arc<Pool>> = OnceLock::new();
    POOL.get_or_init(fresh_test_pool).clone()
}
