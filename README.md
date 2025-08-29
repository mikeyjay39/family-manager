# family-manager

## How to run

```bash
cargo run
```

## Example API calls

```bash
curl --location 'http://127.0.0.1:3000/documents/1'
```

## Installation

### Diesel

See this tutorial: https://docs.yugabyte.com/preview/drivers-orms/rust/diesel/

Install the Diesel command-line interface for PostgreSQL:

```bash
cargo install diesel_cli --no-default-features --features postgres
```

Next, tell Diesel where to find your database. In the project's main directory, create a file called .env with the following content:

```bash
DATABASE_URL=postgres://yugabyte:yugabyte@localhost:5433/ysql_diesel
```

Execute the following command to finish setting up the project:

```bash
diesel setup
```

This creates an empty migrations directory that you can use to manage your schema. It also creates the ysql_diesel database.

## Planned Features

#### Document Manager
* Store documents and associate them with family members
* Automate reminders to alert users before documents expire

### Medical Manager
* Diary of doctor visits
* Track personal health data (height, weight, etc) over time and visualize with charts

### Location Manager
* Integrate with Google's "find my device" feature to show location of everyone on a map

### Car Manager
* Diary of mechanic visits and history

### Receipt Manager
* Upload and store receipts. Possibly parsing info such as vendor name, date, and amount from
the receipt image

```mermaid
---
title: Aggregates, Entities and Value Objects
---

flowchart TD

  M-->Did
  D-->Mid
  D-->A

    M[Member]
    D[Document]
    Mid[MemberId]
    Did[DocumentId]
    A[Alert]
```
