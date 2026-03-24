Create a new epic on the agent-board.

$ARGUMENTS contains the epic title and an optional description.

## Steps

1. Resolve the "To Do" status ID (used as the initial status for the epic):

```
GET http://localhost:31377/api/statuses
```

Find the status whose `name` is `"To Do"`. Extract its `id`. If none exists, use the status with the lowest `position`.

2. Create the epic:

```
POST http://localhost:31377/api/epics
Content-Type: application/json

{
  "title": "<epic title>",
  "description": "<optional description>",
  "statusId": "<To Do status ID>"
}
```

`description` and `statusId` are optional — omit `description` if not provided. `statusId` is optional on the server but it's good practice to set it.

3. Print the full returned epic object including its `id`.

<!--
Equivalent curl:

TODO_ID=$(curl -s http://localhost:31377/api/statuses | \
  jq -r '.[] | select(.name == "To Do") | .id')

curl -s -X POST http://localhost:31377/api/epics \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Authentication Overhaul\",\"description\":\"Replace legacy session tokens with JWTs\",\"statusId\":\"$TODO_ID\"}"
-->
