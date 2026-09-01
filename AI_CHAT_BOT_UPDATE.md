# SecureFile AI Chat Bot

The AI module is now tenant/user scoped.

## What it can do
- Answer SecureFile questions using the currently authenticated user's authorized workspace context.
- See only the current user's owned files/folders, explicitly shared resources, assigned tasks, submitted requests, assigned approvals, personal fax line/jobs, groups they belong to, and unread notification count.
- It does not load another user's private files/folders/messages/tasks/faxes into the AI context.
- Maintains the current chat history in the browser for multi-turn conversations.
- Can answer general/external questions through OpenAI Responses API web search when configured.
- External web research is performed without sending the user's private SecureFile context to the web-search request; the web result is then combined with the private context in a second model call.

## Backend environment
```env
AI_API_KEY=your-openai-api-key
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-5.6-luna
AI_PROVIDER=openai
AI_WEB_SEARCH_ENABLED=true
```

The implementation uses the OpenAI Responses API when `AI_PROVIDER=openai` or when `AI_BASE_URL` points to `api.openai.com`. OpenAI's Responses API supports built-in web search tools.

If an OpenAI-compatible Chat Completions provider is used instead, SecureFile-specific AI still works, but live web search is not automatically available through that provider.

## Security rule
Never put a service API key in frontend code. `AI_API_KEY` stays in the backend environment only.
