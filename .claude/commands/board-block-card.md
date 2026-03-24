Mark a card as Blocked and post a reason comment.

$ARGUMENTS contains the card ID followed by the reason the card is blocked.

## Steps

1. Resolve the "Blocked" status ID:

```
GET http://localhost:31377/api/statuses
```

Find the status whose `name` is `"Blocked"`. Extract its `id`.

2. Update the card's status:

```
PATCH http://localhost:31377/api/cards/<cardId>
Content-Type: application/json

{
  "statusId": "<Blocked status ID>"
}
```

3. Post the reason as a comment:

```
POST http://localhost:31377/api/cards/<cardId>/comments
Content-Type: application/json

{
  "body": "Blocked: <reason from $ARGUMENTS>",
  "author": "agent"
}
```

4. Print the updated card and the posted comment.

<!--
Equivalent curl:

BLOCKED_ID=$(curl -s http://localhost:31377/api/statuses | \
  jq -r '.[] | select(.name == "Blocked") | .id')

curl -s -X PATCH http://localhost:31377/api/cards/<cardId> \
  -H "Content-Type: application/json" \
  -d "{\"statusId\":\"$BLOCKED_ID\"}"

curl -s -X POST http://localhost:31377/api/cards/<cardId>/comments \
  -H "Content-Type: application/json" \
  -d '{"body":"Blocked: waiting for API credentials from the platform team","author":"agent"}'
-->
