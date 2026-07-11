use diesel::prelude::*;
use serde::Serialize;

#[derive(Serialize, Queryable, Selectable, Debug, Clone)]
#[diesel(table_name = crate::schema::documents)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct DocumentEntity {
    pub id: String,
    pub title: String,
    pub content: String,
    pub user_id: String,
    pub created_at: chrono::NaiveDateTime,
}

#[derive(Insertable, Debug, Clone)]
#[diesel(table_name = crate::schema::documents)]
pub struct NewDocumentEntity {
    pub id: String,
    pub title: String,
    pub content: String,
    pub user_id: String,
    pub created_at: chrono::NaiveDateTime,
}
