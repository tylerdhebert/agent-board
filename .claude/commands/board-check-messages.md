Check the agent chat queue for pending messages addressed to your agent.

$ARGUMENTS contains your agent id (e.g. `implementer-1`).

## Steps

1. Poll for pending messages using your exact agent id:

```
GET http://localhost:31377/api/queue?agentId=<your-agent-id>&status=pending
```

2. Print each message in chronological order:

```
[<createdAt>] <author> → <agentId>: <body>
```

3. If there are no pending messages, print "No pending messages for <agentId>."

4. After reading, mark each message as read:

```
POST http://localhost:31377/api/queue/<messageId>/read
```

<!--
Equivalent curl:

curl -s "http://localhost:31377/api/queue?agentId=implementer-1&status=pending" | \
  jq '.[] | {id, author, agentId, body, createdAt}'

# Mark each as read
curl -s -X POST http://localhost:31377/api/queue/<id>/read
-->
