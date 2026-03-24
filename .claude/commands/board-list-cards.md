List cards on the agent-board.

$ARGUMENTS is an optional status name to filter by (e.g. "In Progress", "Blocked"). If empty, list all cards.

## Steps

**If a status filter was provided:**

1. Resolve the status name to an ID:

```
GET http://localhost:31377/api/statuses
```

Find the status whose `name` matches the argument (case-insensitive). Extract its `id`.

2. Fetch filtered cards:

```
GET http://localhost:31377/api/cards?status=<statusId>
```

**If no filter was provided:**

```
GET http://localhost:31377/api/cards
```

## Output

Print a compact table with these columns:

```
ID                                   | TITLE                        | TYPE  | STATUS ID                            | AGENT
-------------------------------------|------------------------------|-------|--------------------------------------|-------
<id>                                 | <title>                      | task  | <statusId>                           | <agentId or —>
```

If you resolved status names in step 1, you can display status names instead of IDs for clarity. Print the total count of cards at the end.

<!--
Equivalent curl:

# All cards
curl -s http://localhost:31377/api/cards | jq '.[] | {id,title,type,statusId,agentId}'

# Filtered
STATUS_ID=$(curl -s http://localhost:31377/api/statuses | \
  jq -r '.[] | select(.name == "Blocked") | .id')
curl -s "http://localhost:31377/api/cards?status=$STATUS_ID" | jq .
-->
