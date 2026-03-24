Create a feature under an existing epic on the agent-board.

$ARGUMENTS contains the epic ID, the feature title, and an optional description.

## Steps

1. Resolve the "To Do" status ID:

```
GET http://localhost:31377/api/statuses
```

Find the status whose `name` is `"To Do"`. Extract its `id`. If none exists, use the status with the lowest `position`.

2. Create the feature:

```
POST http://localhost:31377/api/features
Content-Type: application/json

{
  "epicId": "<epic ID from $ARGUMENTS>",
  "title": "<feature title>",
  "description": "<optional description>",
  "statusId": "<To Do status ID>"
}
```

`description` and `statusId` are optional. `epicId` is required — if the user did not provide a valid epic ID, ask for it before proceeding.

3. Print the full returned feature object including its `id` and `epicId`.

<!--
Equivalent curl:

TODO_ID=$(curl -s http://localhost:31377/api/statuses | \
  jq -r '.[] | select(.name == "To Do") | .id')

curl -s -X POST http://localhost:31377/api/features \
  -H "Content-Type: application/json" \
  -d "{\"epicId\":\"<epicId>\",\"title\":\"JWT Issuance\",\"description\":\"Implement token signing and refresh flow\",\"statusId\":\"$TODO_ID\"}"
-->
