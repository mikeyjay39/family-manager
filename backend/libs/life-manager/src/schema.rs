diesel::table! {
    documents (id) {
        id -> Text,
        title -> Text,
        content -> Text,
        user_id -> Text,
        created_at -> Timestamp,
        issued_date -> Nullable<Timestamp>,
        expire_date -> Nullable<Timestamp>,
        storage_provider -> Nullable<Text>,
        storage_share_id -> Nullable<Text>,
        storage_node_id -> Nullable<Text>,
        storage_filename -> Nullable<Text>,
        storage_mime_type -> Nullable<Text>,
    }
}

diesel::table! {
    tags (id) {
        id -> Text,
        name -> Text,
    }
}

diesel::table! {
    document_tags (document_id, tag_id) {
        document_id -> Text,
        tag_id -> Text,
    }
}

diesel::joinable!(document_tags -> documents (document_id));
diesel::joinable!(document_tags -> tags (tag_id));

diesel::allow_tables_to_appear_in_same_query!(
    documents,
    tags,
    document_tags,
);
