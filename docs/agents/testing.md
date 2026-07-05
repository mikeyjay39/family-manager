# Testing (agents)

Parent hub: [../../AGENTS.md](../../AGENTS.md).

Match CI: [`.github/workflows/main.yml`](../../.github/workflows/main.yml).

On **push to `main`** (after tests pass), CI builds and pushes prod images to ECR only when their directories changed (`backend/` → `life-manager-backend`, `frontend/` → `life-manager-frontend`, `nginx/` → `life-manager-gateway`, `observability/` → `alloy`), then always deploys on Lightsail via SSH. Sequence diagram: [architecture.md — CI deploy to AWS](../architecture.md#ci-deploy-to-aws-merge-to-main).

## Commands

**Frontend (Vitest):**

```bash
cd frontend && npm ci && npm run test:run
npm run lint   # if frontend changed
```

**Backend unit:**

```bash
./backend/scripts/write_rev.sh
cargo test --lib --workspace --manifest-path backend/Cargo.toml
```

**TypeScript DTO export** (CI also checks generated output is committed):

```bash
./backend/scripts/export_ts_bindings.sh
git diff --exit-code -- frontend/lib/api/generated/
```

**Backend integration** (Docker via testcontainers — `backend/tests/common/`):

```bash
./backend/scripts/write_rev.sh
cd backend && cargo test --test '*'
```

**Optional Rust checks** (installed in CI; not always run in workflow):

```bash
cargo fmt --manifest-path backend/Cargo.toml -- --check
cargo clippy --manifest-path backend/Cargo.toml -- -D warnings
```

## Layout

- Frontend: co-locate `*.test.tsx` next to components
- Backend unit: `#[cfg(test)]` in modules (e.g. `document_handler.rs`)
- Backend integration: `backend/tests/*_tests.rs`

## Ignored tests

Some tests use `#[ignore]` (e.g. docker-compose integration in `documents_tests.rs`, Ollama adapter tests). Normal `cargo test --test '*'` **does not run** them unless `--ignored`. Do not assume they passed.

## BDD / Gherkin style

Add behavior-focused unit tests for new features whenever possible. Use **Given / When / Then** via test names, Arrange–Act–Assert, and/or comments. Reuse **Given\*** fixtures or setup helpers.

**Frontend example (Vitest):**

```typescript
it('given no token when rendering then shows sign-in message', () => {
  // Given
  mockUseAuth.mockReturnValue(defaultAuth({ token: null }));
  // When
  render(<DocumentList />);
  // Then
  expect(screen.getByText('Sign in to see your documents.')).toBeTruthy();
});
```

**Backend example (Rust):**

```rust
#[tokio::test]
async fn test_get_document() {
    // Given
    let GivenUserAndDocuments { auth_user, document1_id, .. } = given_user_and_documents().await;
    // When
    let response = get_document(auth_user, State(...), Path(document1_id)).await;
    // Then
    assert_eq!(response.status(), StatusCode::OK);
}
```

See [../../backend/AGENTS.md](../../backend/AGENTS.md) and [../../frontend/AGENTS.md](../../frontend/AGENTS.md) for stack-specific patterns and example files.
