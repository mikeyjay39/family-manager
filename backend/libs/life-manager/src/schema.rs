diesel::table! {
    documents (id) {
        id -> Text,
        title -> Text,
        content -> Text,
        user_id -> Text,
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
