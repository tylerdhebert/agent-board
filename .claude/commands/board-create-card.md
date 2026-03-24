Create a new card on the agent-board.

$ARGUMENTS contains a free-form description of the card to create (title, type, agent ID, epic/feature associations, etc.). Parse it to extract as many fields as you can.

## Steps

1. Resolve the "To Do" status ID:

```
GET http://localhost:31377/api/statuses
Content-Type: application/json
```

Find the status whose `name` is `"To Do"`. If none exists, use the status with the lowest `position` value.

2. Create the card:

```
POST http://localhost:31377/api/cards
Content-Type: application/json

{
  "title": "<card title>",
  "statusId": "<To Do status ID>",
  "type": "<story|bug|task — default: task>",
  "description": "<optional description>",
  "agentId": "<optional agent identifier>",
  "epicId": "<optional epic ID>",
  "featureId": "<optional feature ID>"
}
```

Only include optional fields if the user provided them.

3. Print the returned card's `id` and `title`.

<!--
Equivalent curl:

curl -s http://localhost:31377/api/statuses | \
  jq '.[] | select(.name == "To Do") | .id'

curl -s -X POST http://localhost:31377/api/cards \
  -H "Content-Type: application/json" \
  -d '{"title":"My task","statusId":"<id>","type":"task"}'
-->
