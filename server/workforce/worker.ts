import { getWorkflowById, updateWorkflowRun, writeAudit } from "../db";
import { runWorkforceGraph, type WorkforcePlan } from "./orchestration";
import type { WorkflowJob } from "./queue";

export async function processWorkflowJob(job: WorkflowJob) {
  const workflow = await getWorkflowById(job.ownerId, job.workflowId);
  if (!workflow) {
    await updateWorkflowRun(job.runId, { status: "failed", error: "Workflow not found or not owned by the current user.", completedAt: new Date() });
    return;
  }
  await updateWorkflowRun(job.runId, { status: "running", startedAt: new Date() });
  try {
    const request = String(job.input.request ?? workflow.description);
    const plan = (job.input.plan ?? null) as WorkforcePlan | null;
    const state = await runWorkforceGraph(request, plan, `workflow-run-${job.runId}`);
    const status = state.status === "waiting_approval" ? "waiting_approval" : "completed";
    await updateWorkflowRun(job.runId, { status, state: state as unknown as Record<string, unknown>, output: { events: state.events }, completedAt: status === "completed" ? new Date() : undefined });
    await writeAudit(job.ownerId, { action: `workflow.${status}`, resourceType: "workflow_run", resourceId: String(job.runId), details: { workflowId: job.workflowId, state: state.status } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown workflow execution error";
    await updateWorkflowRun(job.runId, { status: "failed", error: message, completedAt: new Date() });
    await writeAudit(job.ownerId, { action: "workflow.failed", resourceType: "workflow_run", resourceId: String(job.runId), outcome: "failed", details: { error: message } });
  }
}
