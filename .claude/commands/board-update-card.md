Update an existing card on the agent-board.

$ARGUMENTS contains a card ID followed by a description of what to change (e.g. new title, new status name, new description, new agentId, new type).

## Steps

1. If the user wants to change the status by name (e.g. "set to In Progress"), resolve the name to an ID first:

```
GET http://localhost:31377/api/statuses
Content-Type: application/json
```

Find the status whose `name` matches the requested name (case-insensitive). Extract its `id`.

2. Send the update. Only include the fields that are actually changing:

```
PATCH http://localhost:31377/api/cards/<cardId>
Content-Type: application/json

{
  "title": "<new title if changing>",
  "description": "<new description if changing>",
  "statusId": "<resolved status ID if changing>",
  "agentId": "<new agentId if changing>",
  "type": "<story|bug|task if changing>"
}
```

3. Print the full updated card object returned by the server.

<!--
Equivalent curl:

# Resolve status
curl -s http://localhost:31377/api/statuses | \
  jq '.[] | select(.name == "In Progress") | .id'

# Update card
curl -s -X PATCH http://localhost:31377/api/cards/<cardId> \
  -H "Content-Type: application/json" \
  -d '{"statusId":"<id>"}'
-->
