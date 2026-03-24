Mark a card as Done on the agent-board.

$ARGUMENTS contains the card ID and an optional completion message.

## Steps

1. Resolve the "Done" status ID:

```
GET http://localhost:31377/api/statuses
```

Find the status whose `name` is `"Done"`. Extract its `id`.

2. Update the card's status:

```
PATCH http://localhost:31377/api/cards/<cardId>
Content-Type: application/json

{
  "statusId": "<Done status ID>"
}
```

3. If the user provided a completion message in $ARGUMENTS, post it as a comment:

```
POST http://localhost:31377/api/cards/<cardId>/comments
Content-Type: application/json

{
  "body": "<completion message>",
  "author": "agent"
}
```

4. Print confirmation: the card ID, its new status, and any comment that was posted.

<!--
Equivalent curl:

DONE_ID=$(curl -s http://localhost:31377/api/statuses | \
  jq -r '.[] | select(.name == "Done") | .id')

curl -s -X PATCH http://localhost:31377/api/cards/<cardId> \
  -H "Content-Type: application/json" \
  -d "{\"statusId\":\"$DONE_ID\"}"

curl -s -X POST http://localhost:31377/api/cards/<cardId>/comments \
  -H "Content-Type: application/json" \
  -d '{"body":"Task complete. All tests passing.","author":"agent"}'
-->
