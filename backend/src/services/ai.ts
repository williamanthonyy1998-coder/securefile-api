import { db } from '../db';
import { AuthedRequest } from '../middleware/auth';
import { env } from '../config/env';

type AiMessage = { role: 'user' | 'assistant'; content: string };

type UserContext = {
  user: { name: string; email: string; role: string; companyName: string; industry: string | null; description: string | null };
  features: string[];
  files: Array<{ name: string; sizeBytes: string; mimeType: string; source: string; folder: string | null; createdAt: string; access: string }>;
  folders: Array<{ name: string; personal: boolean; createdAt: string; access: string }>;
  tasks: Array<{ title: string; description: string | null; status: string; priority: string; dueAt: string | null; file: string | null; folder: string | null }>;
  requests: Array<{ requestedName: string; requestedType: string; status: string; canDownload: boolean; createdAt: string }>;
  approvals: Array<{ requestedName: string | null; status: string; canDownload: boolean; createdAt: string }>;
  fax: { number: string | null; jobs: Array<{ direction: string; status: string; recipient: string | null; sender: string | null; file: string | null; pages: number | null; createdAt: string }> };
  groups: string[];
  unreadNotifications: number;
};

const productKnowledge = `
SecureFile is a private company/office file-management SaaS. Core areas include Dashboard, User Management, Files, Shared, Trash, Requests, Approvals, Task Management, Chat, Scan Documents, Fax Documents, AI Chat Bot and Settings.
Files and folders are permission-controlled. Users can work with resources they own or resources explicitly shared/granted to them. Company admins have broader administrative access. Personal folders are private unless explicitly shared.
Chat is company-scoped. Scanner supports a Windows bridge for physical scanners plus phone-camera scanning on mobile. Fax supports a personal SecureFile fax number for inbound/outbound faxing when the fax provider is configured. Notifications are realtime through the SecureFile realtime channel.
The AI assistant must never claim access to a file, folder, message, task, fax, user, or other tenant resource unless it appears in the current user's authorized context.
If asked about a SecureFile feature that is not present in the provided context, explain the known workflow and clearly say when a setting/integration must be configured.
`;

function isExternalQuestion(message: string) {
  const q = message.toLowerCase();
  const softwareTerms = ['securefile', 'my file', 'my files', 'my folder', 'my task', 'my fax', 'my request', 'my approval', 'my account', 'my notification', 'my chat'];
  const externalSignals = [
    'latest', 'today', 'current', 'news', 'weather', 'stock', 'price', 'exchange rate', 'what is', 'who is', 'when is',
    'gemini', 'chatgpt', 'openai', 'google', 'microsoft', 'github', 'research', 'internet', 'web search', 'online',
    'define ', 'meaning of', 'compare ', 'vs ', 'versus ', 'market', 'president', 'election', 'release date'
  ];
  if (softwareTerms.some(x => q.includes(x))) {
    const explicitExternal = ['gemini', 'chatgpt', 'openai', 'google', 'microsoft', 'news', 'weather', 'stock', 'exchange rate', 'internet', 'web search', 'research', 'github'].some(x => q.includes(x));
    if (!explicitExternal) return false;
  }
  return externalSignals.some(x => q.includes(x));
}

async function buildUserContext(req: AuthedRequest): Promise<UserContext> {
  const userId = req.user!.id;
  const companyId = req.user!.companyId!;
  const [user, company, ownedFiles, sharedFiles, ownedFolders, sharedFolders, tasks, requests, approvals, faxLine, faxJobs, groups, unreadNotifications] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { id: true, uniqueName: true, email: true, role: true } }),
    db.company.findUnique({ where: { id: companyId }, select: { id: true, name: true, businessIndustry: true, businessDescription: true } }),
    db.file.findMany({ where: { companyId, ownerId: userId, deletedAt: null }, select: { id: true, name: true, sizeBytes: true, mimeType: true, source: true, createdAt: true, folder: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 250 }),
    db.share.findMany({ where: { companyId, recipientId: userId, canView: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }], file: { deletedAt: null } }, select: { file: { select: { id: true, name: true, sizeBytes: true, mimeType: true, source: true, createdAt: true, folder: { select: { name: true } } } }, canDownload: true }, orderBy: { createdAt: 'desc' }, take: 250 }),
    db.folder.findMany({ where: { companyId, ownerId: userId, deletedAt: null }, select: { id: true, name: true, isPersonal: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 250 }),
    db.share.findMany({ where: { companyId, recipientId: userId, canView: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }], folder: { deletedAt: null } }, select: { folder: { select: { id: true, name: true, isPersonal: true, createdAt: true } }, canDownload: true }, orderBy: { createdAt: 'desc' }, take: 250 }),
    db.task.findMany({ where: { companyId, assigneeId: userId, deletedAt: null }, select: { id: true, title: true, description: true, status: true, priority: true, dueAt: true, file: { select: { name: true } }, folder: { select: { name: true } } }, orderBy: { dueAt: 'asc' }, take: 100 }),
    db.accessRequest.findMany({ where: { companyId, requesterId: userId }, select: { id: true, requestedName: true, requestedType: true, status: true, canDownload: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 100 }),
    db.approval.findMany({ where: { companyId, approverId: userId }, select: { id: true, status: true, canDownload: true, createdAt: true, accessRequest: { select: { requestedName: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }),
    db.faxLine.findUnique({ where: { userId }, select: { phoneNumber: true, active: true } }),
    db.faxJob.findMany({ where: { companyId, userId }, select: { direction: true, status: true, recipientNumber: true, senderNumber: true, pages: true, createdAt: true, file: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }),
    db.group.findMany({ where: { companyId, members: { some: { userId } } }, select: { name: true }, orderBy: { name: 'asc' }, take: 100 }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);

  if (!user || !company) throw new Error('Current user context could not be loaded.');

  const filesRaw = [
    ...ownedFiles.map(f => ({ id: f.id, name: f.name, sizeBytes: f.sizeBytes.toString(), mimeType: f.mimeType, source: f.source, folder: f.folder?.name || null, createdAt: f.createdAt.toISOString(), access: 'owner' })),
    ...sharedFiles.filter(x => x.file).map(x => ({ id: x.file!.id, name: x.file!.name, sizeBytes: x.file!.sizeBytes.toString(), mimeType: x.file!.mimeType, source: x.file!.source, folder: x.file!.folder?.name || null, createdAt: x.file!.createdAt.toISOString(), access: x.canDownload ? 'shared: view+download' : 'shared: view' })),
  ];
  const foldersRaw = [
    ...ownedFolders.map(f => ({ id: f.id, name: f.name, personal: f.isPersonal, createdAt: f.createdAt.toISOString(), access: 'owner' })),
    ...sharedFolders.filter(x => x.folder).map(x => ({ id: x.folder!.id, name: x.folder!.name, personal: x.folder!.isPersonal, createdAt: x.folder!.createdAt.toISOString(), access: x.canDownload ? 'shared: view+download' : 'shared: view' })),
  ];
  const uniqueById = <T extends { id: string }>(items: T[]) => [...new Map(items.map(x => [x.id, x])).values()];
  const files = uniqueById(filesRaw).map(({ id: _id, ...rest }) => rest);
  const folders = uniqueById(foldersRaw).map(({ id: _id, ...rest }) => rest);

  return {
    user: { name: user.uniqueName, email: user.email, role: user.role, companyName: company.name, industry: company.businessIndustry, description: company.businessDescription },
    features: ['Dashboard', 'User Management', 'Files', 'Shared', 'Trash', 'Requests', 'Approvals', 'Task Management', 'Chat', 'Scan Documents', 'Fax Documents', 'AI Chat Bot', 'Settings'],
    files, folders,
    tasks: tasks.map(t => ({ title: t.title, description: t.description, status: t.status, priority: t.priority, dueAt: t.dueAt?.toISOString() || null, file: t.file?.name || null, folder: t.folder?.name || null })),
    requests: requests.map(x => ({ requestedName: x.requestedName, requestedType: x.requestedType, status: x.status, canDownload: x.canDownload, createdAt: x.createdAt.toISOString() })),
    approvals: approvals.map(x => ({ requestedName: x.accessRequest?.requestedName || null, status: x.status, canDownload: x.canDownload, createdAt: x.createdAt.toISOString() })),
    fax: { number: faxLine?.active ? faxLine.phoneNumber : null, jobs: faxJobs.map(x => ({ direction: x.direction, status: x.status, recipient: x.recipientNumber, sender: x.senderNumber, file: x.file?.name || null, pages: x.pages, createdAt: x.createdAt.toISOString() })) },
    groups: groups.map(g => g.name), unreadNotifications,
  };
}

function contextText(ctx: UserContext) {
  return JSON.stringify(ctx, null, 2);
}

async function openAiResponses(input: unknown, useWebSearch = false) {
  const base = (env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const url = `${base}/responses`;
  const body: any = { model: env.AI_MODEL || 'gpt-5.6-luna', input, max_output_tokens: 1800 };
  if (useWebSearch) body.tools = [{ type: 'web_search', search_context_size: 'medium' }];
  const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${env.AI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const text = await response.text();
  let data: any = null; try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) throw new Error(data?.error?.message || `AI provider error (${response.status})`);
  const answer = data?.output_text || data?.output?.filter((x: any) => x.type === 'message').flatMap((x: any) => x.content || []).filter((x: any) => x.type === 'output_text').map((x: any) => x.text).join('\n') || '';
  return { answer: String(answer || 'No answer returned.'), raw: data };
}

async function openAiCompatibleChat(message: string, history: AiMessage[], ctx: UserContext) {
  const base = (env.AI_BASE_URL || '').replace(/\/$/, '');
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST', headers: { Authorization: `Bearer ${env.AI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: env.AI_MODEL, messages: [
      { role: 'system', content: `${productKnowledge}\nCURRENT USER AUTHORIZED CONTEXT (never expose IDs/secrets; only answer from this context):\n${contextText(ctx)}` },
      ...history.slice(-12),
      { role: 'user', content: message },
    ], temperature: 0.2, max_tokens: 1800 }),
  });
  const data: any = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || 'AI provider error');
  return { answer: data.choices?.[0]?.message?.content || 'No answer returned.' };
}

export async function answerAi(req: AuthedRequest, message: string, history: AiMessage[], webRequested: boolean) {
  const ctx = await buildUserContext(req);
  const external = webRequested && isExternalQuestion(message);
  const providerIsOpenAi = env.AI_PROVIDER === 'openai' || (env.AI_BASE_URL || '').includes('api.openai.com');

  if (!env.AI_API_KEY || !env.AI_MODEL) return { answer: 'SecureFile AI is not configured. Add AI_API_KEY and AI_MODEL to the backend environment.' };

  const system = `${productKnowledge}\nYou are answering the currently authenticated SecureFile user only. Never reveal information about another user's private resources or another company's tenant. Never infer or fabricate access. Treat the CURRENT USER AUTHORIZED CONTEXT below as the only source of SecureFile-specific facts. If the user asks for an external/general fact, use the web research supplied below when present.\nCURRENT USER AUTHORIZED CONTEXT:\n${contextText(ctx)}`;

  if (providerIsOpenAi) {
    let webResearch = '';
    let citations: any[] = [];
    if (external && env.AI_WEB_SEARCH_ENABLED) {
      const web = await openAiResponses([{ role: 'user', content: [{ type: 'input_text', text: message }] }], true);
      webResearch = web.answer;
      const calls = Array.isArray(web.raw?.output) ? web.raw.output.filter((x: any) => x.type === 'web_search_call') : [];
      citations = calls.flatMap((x: any) => x.action?.sources || []).map((s: any) => ({ url: s.url })).filter((x: any) => x.url).slice(0, 10);
    }
    const prompt = `${message}${webResearch ? `\n\nEXTERNAL WEB RESEARCH (use only as external information; do not treat it as SecureFile data):\n${webResearch}` : ''}`;
    const response = await openAiResponses([{ role: 'system', content: system }, ...history.slice(-12).map(x => ({ role: x.role, content: [{ type: 'input_text', text: x.content }] })), { role: 'user', content: [{ type: 'input_text', text: prompt }] }]);
    return { answer: response.answer, webSearched: Boolean(webResearch), sources: citations };
  }

  if (external) {
    return { answer: 'External web research is available when the SecureFile AI provider is configured with OpenAI Responses API. Your current provider is OpenAI-compatible Chat Completions, so I can answer from the model but cannot safely perform live web search from this provider.', webSearched: false, sources: [] };
  }
  return { ...(await openAiCompatibleChat(message, history, ctx)), webSearched: false, sources: [] };
}
