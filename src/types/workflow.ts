import type { Edge, Node } from "reactflow";

export type WorkflowNodeType =
  | "trigger"
  | "http"
  | "transform"
  | "ai"
  | "delay"
  | "webhook";

export interface WorkflowNodeData {
  label: string;
  type: WorkflowNodeType;
  description?: string;
  config: Record<string, any>;
}

export type WorkflowNode = Node<WorkflowNodeData>;
export type WorkflowEdge = Edge;

export interface RunLogEntry {
  nodeId: string;
  nodeLabel: string;
  status: "running" | "success" | "error";
  detail: string;
  timestamp: number;
}

export interface WorkflowExecutionResult {
  logs: RunLogEntry[];
  output: Record<string, any>;
  error?: string;
}

export interface WorkflowDraft {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: number;
  updatedAt: number;
}
