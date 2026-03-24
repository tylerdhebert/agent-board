Post a comment on a card on the agent-board.

$ARGUMENTS contains the card ID followed by the comment text.

## Steps

Post the comment:

```
POST http://localhost:31377/api/cards/<cardId>/comments
Content-Type: application/json

{
  "body": "<comment text>",
  "author": "agent"
}
```

The `author` field must be either `"agent"` or `"user"`. Always use `"agent"` when posting programmatically from a Claude session.

Print the returned comment's `id`, `author`, `body`, and `createdAt` as confirmation.

<!--
Equivalent curl:

curl -s -X POST http://localhost:31377/api/cards/<cardId>/comments \
  -H "Content-Type: application/json" \
  -d '{"body":"Work complete. Output written to /tmp/result.json","author":"agent"}'
-->
