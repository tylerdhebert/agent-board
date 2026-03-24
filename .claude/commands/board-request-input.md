Request user input for a card and block until the user answers in the UI.

$ARGUMENTS contains the card ID followed by the questions to ask.

This endpoint long-polls: the HTTP request remains open until the user submits answers in the agent-board UI (or the timeout expires). The agent's execution blocks here. This is intentional — do not wrap in a timeout or treat a delayed response as a failure.

## Question Type Definition

Each question must conform to this type:

```ts
type Question = {
  id: string;          // unique identifier for this question within the request
  type: 'text' | 'yesno' | 'choice';
  prompt: string;      // human-readable question text shown to the user
  default?: string;    // optional default value (applies to text inputs)
  options?: string[];  // required when type === 'choice'; the list of choices
};
```

- `"text"` — free-form text input
- `"yesno"` — yes/no toggle; answer will be `"yes"` or `"no"`
- `"choice"` — single-select from `options`; answer will be one of the option strings

## Step

POST to the long-poll endpoint. The server will block until answered:

```
POST http://localhost:31377/api/input
Content-Type: application/json

{
  "cardId": "<card ID>",
  "questions": [
    {
      "id": "q1",
      "type": "yesno",
      "prompt": "Should I proceed with the deployment?"
    },
    {
      "id": "q2",
      "type": "choice",
      "prompt": "Which environment?",
      "options": ["staging", "production"]
    },
    {
      "id": "q3",
      "type": "text",
      "prompt": "Any notes for the deployment log?",
      "default": "none"
    }
  ],
  "timeoutSecs": 900
}
```

`timeoutSecs` is optional and defaults to 900 (15 minutes). Omit it unless the user specified a different timeout.

## Response

On success (HTTP 200):

```json
{
  "requestId": "<uuid>",
  "status": "answered",
  "answers": {
    "q1": "yes",
    "q2": "production",
    "q3": "rollback if p95 latency > 500ms"
  }
}
```

On timeout (HTTP 408):

```json
{
  "requestId": "<uuid>",
  "status": "timed_out",
  "answers": null
}
```

Print the returned answers when they arrive. If the request timed out, print a clear message indicating the timeout and the `requestId`.

<!--
Equivalent curl (will block until answered):

curl -s -X POST http://localhost:31377/api/input \
  -H "Content-Type: application/json" \
  -d '{
    "cardId": "card-uuid",
    "questions": [
      {"id":"confirm","type":"yesno","prompt":"Proceed?"}
    ]
  }'
-->
