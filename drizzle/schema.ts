import {
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const workspaces = mysqlTable("workspaces", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull(),
  description: text("description"),
  rightHandAgentId: int("rightHandAgentId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ ownerIdx: index("workspace_owner_idx").on(table.ownerId), slugUnique: uniqueIndex("workspace_slug_unique").on(table.slug) }));

export const departments = mysqlTable("departments", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  purpose: text("purpose").notNull(),
  color: varchar("color", { length: 32 }).default("mint").notNull(),
  status: mysqlEnum("status", ["active", "paused", "archived"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ workspaceIdx: index("department_workspace_idx").on(table.workspaceId) }));

export const agents = mysqlTable("agents", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  departmentId: int("departmentId"),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull(),
  role: varchar("role", { length: 160 }).notNull(),
  avatar: varchar("avatar", { length: 8 }).notNull(),
  accent: varchar("accent", { length: 32 }).default("mint").notNull(),
  status: mysqlEnum("status", ["online", "working", "idle", "offline"]).default("idle").notNull(),
  model: varchar("model", { length: 120 }),
  expertise: json("expertise").$type<string[]>().notNull(),
  permissions: json("permissions").$type<string[]>().notNull(),
  systemPrompt: text("systemPrompt"),
  isRightHand: boolean("isRightHand").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ workspaceIdx: index("agent_workspace_idx").on(table.workspaceId), departmentIdx: index("agent_department_idx").on(table.departmentId), slugUnique: uniqueIndex("agent_slug_unique").on(table.workspaceId, table.slug) }));

export const agentMemories = mysqlTable("agent_memories", {
  id: int("id").autoincrement().primaryKey(),
  agentId: int("agentId").notNull(),
  workspaceId: int("workspaceId").notNull(),
  kind: mysqlEnum("kind", ["semantic", "episodic", "working", "preference"]).default("semantic").notNull(),
  content: text("content").notNull(),
  source: varchar("source", { length: 160 }),
  importance: int("importance").default(50).notNull(),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ agentIdx: index("memory_agent_idx").on(table.agentId), workspaceIdx: index("memory_workspace_idx").on(table.workspaceId) }));

export const knowledgeSources = mysqlTable("knowledge_sources", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  departmentId: int("departmentId"),
  title: varchar("title", { length: 220 }).notNull(),
  sourceType: mysqlEnum("sourceType", ["document", "url", "note", "database", "conversation"]).default("document").notNull(),
  uri: text("uri"),
  status: mysqlEnum("status", ["ready", "syncing", "error", "archived"]).default("ready").notNull(),
  chunkCount: int("chunkCount").default(0).notNull(),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ workspaceIdx: index("knowledge_workspace_idx").on(table.workspaceId), departmentIdx: index("knowledge_department_idx").on(table.departmentId) }));

export const tools = mysqlTable("tools", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  kind: mysqlEnum("kind", ["connector", "function", "browser", "code", "data"]).default("function").notNull(),
  description: text("description").notNull(),
  riskLevel: mysqlEnum("riskLevel", ["low", "medium", "high", "critical"]).default("low").notNull(),
  config: json("config").$type<Record<string, unknown>>(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ workspaceIdx: index("tool_workspace_idx").on(table.workspaceId), nameUnique: uniqueIndex("tool_name_unique").on(table.workspaceId, table.name) }));

export const agentTools = mysqlTable("agent_tools", {
  agentId: int("agentId").notNull(),
  toolId: int("toolId").notNull(),
  grantedBy: int("grantedBy"),
  grantedAt: timestamp("grantedAt").defaultNow().notNull(),
}, (table) => ({ pk: uniqueIndex("agent_tool_unique").on(table.agentId, table.toolId) }));

export const workflows = mysqlTable("workflows", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  departmentId: int("departmentId"),
  name: varchar("name", { length: 180 }).notNull(),
  description: text("description").notNull(),
  trigger: varchar("trigger", { length: 180 }).notNull(),
  status: mysqlEnum("status", ["draft", "active", "paused", "archived"]).default("draft").notNull(),
  graphDefinition: json("graphDefinition").$type<Record<string, unknown>>().notNull(),
  requiresApproval: boolean("requiresApproval").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ workspaceIdx: index("workflow_workspace_idx").on(table.workspaceId) }));

export const workflowRuns = mysqlTable("workflow_runs", {
  id: int("id").autoincrement().primaryKey(),
  workflowId: int("workflowId").notNull(),
  workspaceId: int("workspaceId").notNull(),
  initiatedBy: int("initiatedBy"),
  status: mysqlEnum("status", ["queued", "running", "waiting_approval", "completed", "failed", "cancelled"]).default("queued").notNull(),
  input: json("input").$type<Record<string, unknown>>(),
  state: json("state").$type<Record<string, unknown>>(),
  output: json("output").$type<Record<string, unknown>>(),
  error: text("error"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ workflowIdx: index("workflow_run_workflow_idx").on(table.workflowId), workspaceIdx: index("workflow_run_workspace_idx").on(table.workspaceId) }));

export const approvals = mysqlTable("approvals", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  workflowRunId: int("workflowRunId"),
  requestedByAgentId: int("requestedByAgentId"),
  requestedForUserId: int("requestedForUserId"),
  action: varchar("action", { length: 180 }).notNull(),
  rationale: text("rationale").notNull(),
  payload: json("payload").$type<Record<string, unknown>>(),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "expired"]).default("pending").notNull(),
  decidedAt: timestamp("decidedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ workspaceIdx: index("approval_workspace_idx").on(table.workspaceId), statusIdx: index("approval_status_idx").on(table.status) }));

export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  departmentId: int("departmentId"),
  kind: mysqlEnum("kind", ["direct", "group", "right_hand", "workflow"]).default("direct").notNull(),
  name: varchar("name", { length: 180 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ workspaceIdx: index("conversation_workspace_idx").on(table.workspaceId), departmentIdx: index("conversation_department_idx").on(table.departmentId) }));

export const conversationParticipants = mysqlTable("conversation_participants", {
  conversationId: int("conversationId").notNull(),
  agentId: int("agentId"),
  userId: int("userId"),
  participantRole: mysqlEnum("participantRole", ["owner", "member", "observer"]).default("member").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
}, (table) => ({ uniqueParticipant: uniqueIndex("conversation_participant_unique").on(table.conversationId, table.agentId, table.userId) }));

export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  senderAgentId: int("senderAgentId"),
  senderUserId: int("senderUserId"),
  parentMessageId: int("parentMessageId"),
  kind: mysqlEnum("kind", ["text", "system", "tool_call", "tool_result", "approval_request", "workflow_event"]).default("text").notNull(),
  content: text("content").notNull(),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ conversationIdx: index("message_conversation_idx").on(table.conversationId, table.createdAt), parentIdx: index("message_parent_idx").on(table.parentMessageId) }));

export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  actorUserId: int("actorUserId"),
  actorAgentId: int("actorAgentId"),
  action: varchar("action", { length: 160 }).notNull(),
  resourceType: varchar("resourceType", { length: 80 }).notNull(),
  resourceId: varchar("resourceId", { length: 80 }),
  outcome: mysqlEnum("outcome", ["success", "denied", "failed", "pending"]).default("success").notNull(),
  details: json("details").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ workspaceIdx: index("audit_workspace_idx").on(table.workspaceId), createdIdx: index("audit_created_idx").on(table.createdAt) }));

export const toolRuns = mysqlTable("tool_runs", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  agentId: int("agentId"),
  toolId: int("toolId").notNull(),
  workflowRunId: int("workflowRunId"),
  status: mysqlEnum("status", ["queued", "running", "completed", "failed", "denied"]).default("queued").notNull(),
  input: json("input").$type<Record<string, unknown>>(),
  output: json("output").$type<Record<string, unknown>>(),
  error: text("error"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ workspaceIdx: index("tool_run_workspace_idx").on(table.workspaceId), statusIdx: index("tool_run_status_idx").on(table.status) }));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Agent = typeof agents.$inferSelect;
export type Department = typeof departments.$inferSelect;
export type Workflow = typeof workflows.$inferSelect;
export type Approval = typeof approvals.$inferSelect;
export type KnowledgeSource = typeof knowledgeSources.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
