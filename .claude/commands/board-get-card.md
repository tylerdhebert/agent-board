Fetch full details of a card including its comment thread.

$ARGUMENTS contains the card ID.

## Step

```
GET http://localhost:31377/api/cards/<cardId>
```

## Response shape

```json
{
  "id": "...",
  "title": "...",
  "type": "story|bug|task",
  "description": "...",
  "statusId": "...",
  "agentId": "...",
  "epicId": "...",
  "featureId": "...",
  "createdAt": "...",
  "updatedAt": "...",
  "comments": [
    {
      "id": "...",
      "cardId": "...",
      "author": "agent|user",
      "body": "...",
      "createdAt": "..."
    }
  ]
}
```

Print the card fields in a readable format, then print the comment thread in chronological order. Format each comment as:

```
[<createdAt>] <author>: <body>
```

If there are no comments, print "No comments."

<!--
Equivalent curl:

curl -s http://localhost:31377/api/cards/<cardId> | jq .
-->
