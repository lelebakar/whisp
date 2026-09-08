import { and, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  agents,
  approvals,
  auditLogs,
  conversationParticipants,
  conversations,
  departments,
  InsertUser,
  knowledgeSources,
  messageAttachments,
  messages,
  tools,
  toolRuns,
  users,
  workflowRuns,
  workflows,
  workspaces,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getDefaultGraphDefinition } from "./workforce/orchestration";

let _db: ReturnType<typeof drizzle> | null = null;
type DbResult = Array<{ insertId?: number | bigint }>;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

function insertId(result: unknown) {
  const id = (result as DbResult)[0]?.insertId;
  return id === undefined ? 0 : Number(id);
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  values.lastSignedIn ??= new Date();
  updateSet.lastSignedIn ??= new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getOrCreateWorkspace(ownerId: number, name = "Personal Company") {
  const db = await getDb();
  if (!db) return null;
  const existing = (await db.select().from(workspaces).where(eq(workspaces.ownerId, ownerId)).limit(1))[0];
  if (existing) return existing;
  const slug = `personal-company-${ownerId}`;
  const result = await db.insert(workspaces).values({ ownerId, name, slug, description: "A private operating system for your AI workforce." });
  const id = insertId(result);
  return (await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1))[0] ?? null;
}

async function workspaceFor(ownerId: number) {
  return getOrCreateWorkspace(ownerId);
}

export async function getWorkspaceSnapshot(ownerId: number) {
  const db = await getDb();
  if (!db) return null;
  const workspace = await workspaceFor(ownerId);
  if (!workspace) return null;
  const [workspaceAgents, workspaceDepartments, workspaceWorkflows, workspaceApprovals, workspaceTools, workspaceKnowledge, workspaceAudit] = await Promise.all([
    db.select().from(agents).where(eq(agents.workspaceId, workspace.id)),
    db.select().from(departments).where(eq(departments.workspaceId, workspace.id)),
    db.select().from(workflows).where(eq(workflows.workspaceId, workspace.id)),
    db.select().from(approvals).where(and(eq(approvals.workspaceId, workspace.id), eq(approvals.status, "pending"))),
    db.select().from(tools).where(eq(tools.workspaceId, workspace.id)),
    db.select().from(knowledgeSources).where(eq(knowledgeSources.workspaceId, workspace.id)),
    db.select().from(auditLogs).where(eq(auditLogs.workspaceId, workspace.id)).orderBy(desc(auditLogs.createdAt)).limit(40),
  ]);
  return { workspace, agents: workspaceAgents, departments: workspaceDepartments, workflows: workspaceWorkflows, approvals: workspaceApprovals, tools: workspaceTools, knowledge: workspaceKnowledge, audit: workspaceAudit };
}

export async function createAgent(ownerId: number, input: { name: string; role: string; slug: string; avatar: string; accent: string; departmentId?: number; expertise: string[]; permissions: string[]; model?: string; systemPrompt?: string; isRightHand?: boolean }) {
  const db = await getDb();
  const workspace = await workspaceFor(ownerId);
  if (!db || !workspace) return null;
  const result = await db.insert(agents).values({ ...input, workspaceId: workspace.id, departmentId: input.departmentId ?? null, model: input.model ?? "gpt-5-mini", systemPrompt: input.systemPrompt ?? null, isRightHand: input.isRightHand ?? false });
  const created = (await db.select().from(agents).where(eq(agents.id, insertId(result))).limit(1))[0] ?? null;
  if (created) await writeAudit(ownerId, { action: "agent.created", resourceType: "agent", resourceId: String(created.id), details: { name: created.name } });
  return created;
}

export async function updateAgent(ownerId: number, id: number, input: Partial<{ name: string; role: string; slug: string; avatar: string; accent: string; departmentId: number | null; expertise: string[]; permissions: string[]; model: string; systemPrompt: string; status: "online" | "working" | "idle" | "offline" }>) {
  const db = await getDb();
  const workspace = await workspaceFor(ownerId);
  if (!db || !workspace) return null;
  await db.update(agents).set(input).where(and(eq(agents.id, id), eq(agents.workspaceId, workspace.id)));
  const updated = (await db.select().from(agents).where(and(eq(agents.id, id), eq(agents.workspaceId, workspace.id))).limit(1))[0] ?? null;
  if (updated) await writeAudit(ownerId, { action: "agent.updated", resourceType: "agent", resourceId: String(id), details: input });
  return updated;
}

export async function createDepartment(ownerId: number, input: { name: string; purpose: string; color: string }) {
  const db = await getDb();
  const workspace = await workspaceFor(ownerId);
  if (!db || !workspace) return null;
  const result = await db.insert(departments).values({ ...input, workspaceId: workspace.id });
  const created = (await db.select().from(departments).where(eq(departments.id, insertId(result))).limit(1))[0] ?? null;
  if (created) await writeAudit(ownerId, { action: "department.created", resourceType: "department", resourceId: String(created.id), details: { name: created.name } });
  return created;
}

export async function updateDepartment(ownerId: number, id: number, input: Partial<{ name: string; purpose: string; color: string; status: "active" | "paused" | "archived" }>) {
  const db = await getDb();
  const workspace = await workspaceFor(ownerId);
  if (!db || !workspace) return null;
  await db.update(departments).set(input).where(and(eq(departments.id, id), eq(departments.workspaceId, workspace.id)));
  const updated = (await db.select().from(departments).where(and(eq(departments.id, id), eq(departments.workspaceId, workspace.id))).limit(1))[0] ?? null;
  if (updated) await writeAudit(ownerId, { action: "department.updated", resourceType: "department", resourceId: String(id), details: input });
  return updated;
}

export async function createWorkflow(ownerId: number, input: { name: string; description: string; trigger: string; departmentId?: number; requiresApproval: boolean; status?: "draft" | "active" | "paused" | "archived" }) {
  const db = await getDb();
  const workspace = await workspaceFor(ownerId);
  if (!db || !workspace) return null;
  const result = await db.insert(workflows).values({ ...input, workspaceId: workspace.id, departmentId: input.departmentId ?? null, status: input.status ?? "draft", graphDefinition: getDefaultGraphDefinition() });
  const created = (await db.select().from(workflows).where(eq(workflows.id, insertId(result))).limit(1))[0] ?? null;
  if (created) await writeAudit(ownerId, { action: "workflow.created", resourceType: "workflow", resourceId: String(created.id), details: { name: created.name } });
  return created;
}

export async function updateWorkflow(ownerId: number, id: number, input: Partial<{ name: string; description: string; trigger: string; departmentId: number | null; requiresApproval: boolean; status: "draft" | "active" | "paused" | "archived"; graphDefinition: Record<string, unknown> }>) {
  const db = await getDb();
  const workspace = await workspaceFor(ownerId);
  if (!db || !workspace) return null;
  await db.update(workflows).set(input).where(and(eq(workflows.id, id), eq(workflows.workspaceId, workspace.id)));
  const updated = (await db.select().from(workflows).where(and(eq(workflows.id, id), eq(workflows.workspaceId, workspace.id))).limit(1))[0] ?? null;
  if (updated) await writeAudit(ownerId, { action: "workflow.updated", resourceType: "workflow", resourceId: String(id), details: input });
  return updated;
}

export async function createKnowledgeSource(ownerId: number, input: { title: string; sourceType: "document" | "url" | "note" | "database" | "conversation"; uri?: string; departmentId?: number; metadata?: Record<string, unknown> }) {
  const db = await getDb();
  const workspace = await workspaceFor(ownerId);
  if (!db || !workspace) return null;
  const result = await db.insert(knowledgeSources).values({ ...input, workspaceId: workspace.id, departmentId: input.departmentId ?? null, uri: input.uri ?? null, metadata: input.metadata ?? null, status: "ready", chunkCount: 0 });
  const created = (await db.select().from(knowledgeSources).where(eq(knowledgeSources.id, insertId(result))).limit(1))[0] ?? null;
  if (created) await writeAudit(ownerId, { action: "knowledge.created", resourceType: "knowledge_source", resourceId: String(created.id), details: { title: created.title } });
  return created;
}

export async function updateKnowledgeSource(ownerId: number, id: number, input: Partial<{ title: string; sourceType: "document" | "url" | "note" | "database" | "conversation"; uri: string | null; departmentId: number | null; status: "ready" | "syncing" | "error" | "archived"; metadata: Record<string, unknown> }>) {
  const db = await getDb();
  const workspace = await workspaceFor(ownerId);
  if (!db || !workspace) return null;
  await db.update(knowledgeSources).set(input).where(and(eq(knowledgeSources.id, id), eq(knowledgeSources.workspaceId, workspace.id)));
  const updated = (await db.select().from(knowledgeSources).where(and(eq(knowledgeSources.id, id), eq(knowledgeSources.workspaceId, workspace.id))).limit(1))[0] ?? null;
  if (updated) await writeAudit(ownerId, { action: "knowledge.updated", resourceType: "knowledge_source", resourceId: String(id), details: input });
  return updated;
}

export async function createWorkflowRun(ownerId: number, workflowId: number, input: Record<string, unknown>) {
  const db = await getDb();
  const workspace = await workspaceFor(ownerId);
  if (!db || !workspace) return null;
  const result = await db.insert(workflowRuns).values({ workflowId, workspaceId: workspace.id, initiatedBy: ownerId, input, status: "queued" });
  return (await db.select().from(workflowRuns).where(eq(workflowRuns.id, insertId(result))).limit(1))[0] ?? null;
}

export async function updateWorkflowRun(id: number, input: Partial<{ status: "queued" | "running" | "waiting_approval" | "completed" | "failed" | "cancelled"; state: Record<string, unknown>; output: Record<string, unknown>; error: string | null; startedAt: Date; completedAt: Date }>) {
  const db = await getDb();
  if (!db) return;
  await db.update(workflowRuns).set(input).where(eq(workflowRuns.id, id));
}

export async function getWorkflowById(ownerId: number, id: number) {
  const db = await getDb();
  const workspace = await workspaceFor(ownerId);
  if (!db || !workspace) return null;
  return (await db.select().from(workflows).where(and(eq(workflows.id, id), eq(workflows.workspaceId, workspace.id))).limit(1))[0] ?? null;
}

export async function getWorkflowRunForOwner(ownerId: number, id: number) {
  const db = await getDb();
  const workspace = await workspaceFor(ownerId);
  if (!db || !workspace) return null;
  return (await db.select().from(workflowRuns).where(and(eq(workflowRuns.id, id), eq(workflowRuns.workspaceId, workspace.id))).limit(1))[0] ?? null;
}

export async function writeAudit(ownerId: number, input: { action: string; resourceType: string; resourceId?: string; outcome?: "success" | "denied" | "failed" | "pending"; actorAgentId?: number; details?: Record<string, unknown> }) {
  const db = await getDb();
  const workspace = await workspaceFor(ownerId);
  if (!db || !workspace) return null;
  await db.insert(auditLogs).values({ workspaceId: workspace.id, actorUserId: ownerId, actorAgentId: input.actorAgentId ?? null, action: input.action, resourceType: input.resourceType, resourceId: input.resourceId ?? null, outcome: input.outcome ?? "success", details: input.details ?? null });
  return true;
}

export async function createToolRun(ownerId: number, input: { toolId: number; agentId?: number; workflowRunId?: number; payload: Record<string, unknown> }) {
  const db = await getDb();
  const workspace = await workspaceFor(ownerId);
  if (!db || !workspace) return null;
  const result = await db.insert(toolRuns).values({ workspaceId: workspace.id, toolId: input.toolId, agentId: input.agentId ?? null, workflowRunId: input.workflowRunId ?? null, input: input.payload, status: "queued" });
  return (await db.select().from(toolRuns).where(eq(toolRuns.id, insertId(result))).limit(1))[0] ?? null;
}

export async function updateToolRun(id: number, input: Partial<{ status: "queued" | "running" | "completed" | "failed" | "denied"; output: Record<string, unknown>; error: string | null; startedAt: Date; completedAt: Date }>) {
  const db = await getDb();
  if (!db) return;
  await db.update(toolRuns).set(input).where(eq(toolRuns.id, id));
}

export async function createApproval(ownerId: number, input: { workflowRunId?: number; requestedByAgentId?: number; action: string; rationale: string; payload?: Record<string, unknown> }) {
  const db = await getDb();
  const workspace = await workspaceFor(ownerId);
  if (!db || !workspace) return null;
  const result = await db.insert(approvals).values({ workspaceId: workspace.id, workflowRunId: input.workflowRunId ?? null, requestedByAgentId: input.requestedByAgentId ?? null, requestedForUserId: ownerId, action: input.action, rationale: input.rationale, payload: input.payload ?? null, status: "pending" });
  return (await db.select().from(approvals).where(eq(approvals.id, insertId(result))).limit(1))[0] ?? null;
}

export async function decideApproval(ownerId: number, id: number, status: "approved" | "rejected") {
  const db = await getDb();
  const workspace = await workspaceFor(ownerId);
  if (!db || !workspace) return null;
  await db.update(approvals).set({ status, decidedAt: new Date() }).where(and(eq(approvals.id, id), eq(approvals.workspaceId, workspace.id), eq(approvals.status, "pending")));
  const approval = (await db.select().from(approvals).where(and(eq(approvals.id, id), eq(approvals.workspaceId, workspace.id))).limit(1))[0] ?? null;
  if (approval) await writeAudit(ownerId, { action: `approval.${status}`, resourceType: "approval", resourceId: String(id), details: { action: approval.action } });
  if (approval?.workflowRunId) await updateWorkflowRun(approval.workflowRunId, { status: status === "approved" ? "queued" : "cancelled" });
  return approval;
}

export async function ensureBuiltinTools(ownerId: number) {
  const db = await getDb();
  const workspace = await workspaceFor(ownerId);
  if (!db || !workspace) return [];
  const existing = await db.select().from(tools).where(eq(tools.workspaceId, workspace.id));
  if (existing.length > 0) return existing;
  await db.insert(tools).values([
    { workspaceId: workspace.id, name: "workspace_overview", kind: "data", description: "Read current agents, departments, workflows, approvals, and knowledge health.", riskLevel: "low", config: { handler: "workspace_overview" }, enabled: true },
    { workspaceId: workspace.id, name: "create_knowledge_note", kind: "function", description: "Create a durable workspace knowledge note.", riskLevel: "medium", config: { handler: "create_knowledge_note" }, enabled: true },
    { workspaceId: workspace.id, name: "request_human_approval", kind: "function", description: "Create a human approval gate before an external or high-risk action.", riskLevel: "high", config: { handler: "request_human_approval" }, enabled: true },
  ]);
  return db.select().from(tools).where(eq(tools.workspaceId, workspace.id));
}

export async function getToolForOwner(ownerId: number, name: string) {
  const available = await ensureBuiltinTools(ownerId);
  return available.find((tool) => tool.name === name) ?? null;
}

export async function listAuditLogs(ownerId: number) {
  const db = await getDb();
  const workspace = await workspaceFor(ownerId);
  if (!db || !workspace) return [];
  return db.select().from(auditLogs).where(eq(auditLogs.workspaceId, workspace.id)).orderBy(desc(auditLogs.createdAt)).limit(60);
}

export async function getChatSnapshot(ownerId: number) {
  const db = await getDb();
  const workspace = await workspaceFor(ownerId);
  if (!db || !workspace) return null;
  const chats = await db.select().from(conversations).where(eq(conversations.workspaceId, workspace.id)).orderBy(desc(conversations.updatedAt));
  const conversationIds = chats.map((chat) => chat.id);
  const chatMessages = conversationIds.length ? await db.select().from(messages).where(inArray(messages.conversationId, conversationIds)).orderBy(messages.createdAt) : [];
  const participants = conversationIds.length ? await db.select().from(conversationParticipants).where(inArray(conversationParticipants.conversationId, conversationIds)) : [];
  return { workspace, chats, messages: chatMessages, participants };
}

export async function createConversation(ownerId: number, input: { name: string; kind: "direct" | "group" | "right_hand" | "workflow"; description?: string; agentIds: number[] }) {
  const db = await getDb();
  const workspace = await workspaceFor(ownerId);
  if (!db || !workspace) return null;
  const result = await db.insert(conversations).values({ workspaceId: workspace.id, name: input.name, kind: input.kind, description: input.description ?? null });
  const id = insertId(result);
  await db.insert(conversationParticipants).values([{ conversationId: id, userId: ownerId, participantRole: "owner" }, ...input.agentIds.map((agentId) => ({ conversationId: id, agentId, participantRole: "member" as const }))]);
  await writeAudit(ownerId, { action: "conversation.created", resourceType: "conversation", resourceId: String(id), details: { name: input.name, kind: input.kind } });
  return (await db.select().from(conversations).where(eq(conversations.id, id)).limit(1))[0] ?? null;
}

export async function createChatMessage(ownerId: number, input: { conversationId: number; content: string; agentId?: number; parentMessageId?: number; kind?: "text" | "system" }) {
  const db = await getDb();
  const workspace = await workspaceFor(ownerId);
  if (!db || !workspace) return null;
  const conversation = (await db.select().from(conversations).where(and(eq(conversations.id, input.conversationId), eq(conversations.workspaceId, workspace.id))).limit(1))[0];
  if (!conversation) return null;
  const result = await db.insert(messages).values({ conversationId: input.conversationId, senderUserId: input.agentId ? null : ownerId, senderAgentId: input.agentId ?? null, parentMessageId: input.parentMessageId ?? null, content: input.content, kind: input.kind ?? "text", isStarred: false });
  await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, input.conversationId));
  return (await db.select().from(messages).where(eq(messages.id, insertId(result))).limit(1))[0] ?? null;
}

export async function updateChatMessage(ownerId: number, id: number, input: { content?: string; isStarred?: boolean; deleted?: boolean }) {
  const db = await getDb();
  const workspace = await workspaceFor(ownerId);
  if (!db || !workspace) return null;
  const rows = await db.select({ message: messages }).from(messages).innerJoin(conversations, eq(messages.conversationId, conversations.id)).where(and(eq(messages.id, id), eq(conversations.workspaceId, workspace.id))).limit(1);
  if (!rows[0]) return null;
  await db.update(messages).set({ content: input.deleted ? "This message was deleted" : input.content, deletedAt: input.deleted ? new Date() : undefined, editedAt: input.content ? new Date() : undefined, isStarred: input.isStarred }).where(eq(messages.id, id));
  return (await db.select().from(messages).where(eq(messages.id, id)).limit(1))[0] ?? null;
}

export async function createMessageAttachment(ownerId: number, input: { messageId: number; kind: "file" | "image" | "audio" | "video" | "document"; fileName: string; mimeType: string; fileSize: number; storageKey: string; url: string }) {
  const db = await getDb();
  const workspace = await workspaceFor(ownerId);
  if (!db || !workspace) return null;
  const result = await db.insert(messageAttachments).values({ ...input, workspaceId: workspace.id });
  return (await db.select().from(messageAttachments).where(eq(messageAttachments.id, insertId(result))).limit(1))[0] ?? null;
}
