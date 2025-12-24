import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  MarkerType,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange
} from "reactflow";
import type {
  RunLogEntry,
  WorkflowDraft,
  WorkflowEdge,
  WorkflowExecutionResult,
  WorkflowNode
} from "@/types/workflow";
import { nanoid } from "@/lib/utils";

interface WorkflowState {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  logs: RunLogEntry[];
  isRunning: boolean;
  lastOutput: Record<string, any> | null;
  activeWorkflowId?: string;
  drafts: WorkflowDraft[];
  selectedNodeId?: string;
  setNodes: (nodes: WorkflowNode[]) => void;
  setEdges: (edges: WorkflowEdge[]) => void;
  addNode: (node: WorkflowNode) => void;
  updateNode: (id: string, data: Partial<WorkflowNode>) => void;
  removeNode: (id: string) => void;
  setSelectedNode: (id?: string) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  upsertDraft: (draft: Omit<WorkflowDraft, "id" | "createdAt" | "updatedAt"> & { id?: string }) => string;
  loadDraft: (id: string) => void;
  deleteDraft: (id: string) => void;
  setActiveWorkflow: (id?: string) => void;
  reset: () => void;
  addLog: (entry: RunLogEntry) => void;
  clearLogs: () => void;
  setRunning: (value: boolean) => void;
  updateExecutionResult: (result: WorkflowExecutionResult) => void;
  setLastOutput: (payload: Record<string, any> | null) => void;
}

const DEFAULT_DRAFT_NAME = "Untitled Workflow";

export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      logs: [],
      isRunning: false,
      lastOutput: null,
      drafts: [],
      activeWorkflowId: undefined,
      selectedNodeId: undefined,
      setNodes: (nodes) => set({ nodes }),
      setEdges: (edges) => set({ edges }),
      addNode: (node) => {
        set({
          nodes: [...get().nodes, node],
          selectedNodeId: node.id
        });
      },
      updateNode: (id, data) => {
        set({
          nodes: get().nodes.map((node) =>
            node.id === id
              ? {
                  ...node,
                  ...data,
                  data: {
                    ...node.data,
                    ...(data.data ?? {})
                  }
                }
              : node
          )
        });
      },
      removeNode: (id) => {
        set({
          nodes: get().nodes.filter((node) => node.id !== id),
          edges: get().edges.filter(
            (edge) => edge.source !== id && edge.target !== id
          ),
          selectedNodeId: get().selectedNodeId === id ? undefined : get().selectedNodeId
        });
      },
      setSelectedNode: (id) => set({ selectedNodeId: id }),
      onNodesChange: (changes) => {
        set({
          nodes: applyNodeChanges(changes, get().nodes)
        });
      },
      onEdgesChange: (changes) => {
        set({
          edges: applyEdgeChanges(changes, get().edges)
        });
      },
      onConnect: (connection) => {
        set({
          edges: addEdge(
            {
              ...connection,
              type: "smoothstep",
              animated: false,
              markerEnd: { type: MarkerType.ArrowClosed }
            },
            get().edges
          )
        });
      },
      upsertDraft: (draft) => {
        const now = Date.now();
        const { nodes, edges, drafts } = get();
        const id = draft.id ?? nanoid();
        const nextDraft: WorkflowDraft = {
          id,
          name: draft.name || DEFAULT_DRAFT_NAME,
          description: draft.description,
          nodes: draft.nodes ?? nodes,
          edges: draft.edges ?? edges,
          createdAt: draft.id
            ? drafts.find((item) => item.id === draft.id)?.createdAt ?? now
            : now,
          updatedAt: now
        };

        const nextDrafts = drafts.some((item) => item.id === id)
          ? drafts.map((item) => (item.id === id ? nextDraft : item))
          : [...drafts, nextDraft];

        set({
          drafts: nextDrafts,
          activeWorkflowId: id
        });

        return id;
      },
      loadDraft: (id) => {
        const draft = get().drafts.find((item) => item.id === id);
        if (!draft) return;

        set({
          nodes: draft.nodes,
          edges: draft.edges,
          activeWorkflowId: id,
          selectedNodeId: undefined,
          logs: []
        });
      },
      deleteDraft: (id) => {
        set({
          drafts: get().drafts.filter((item) => item.id !== id),
          activeWorkflowId: get().activeWorkflowId === id ? undefined : get().activeWorkflowId
        });
      },
      setActiveWorkflow: (id) => set({ activeWorkflowId: id }),
      reset: () =>
        set({
          nodes: [],
          edges: [],
          selectedNodeId: undefined,
          logs: [],
          isRunning: false,
          lastOutput: null
        }),
      addLog: (entry) => set({ logs: [...get().logs, entry] }),
      clearLogs: () => set({ logs: [] }),
      setRunning: (value) => set({ isRunning: value }),
      updateExecutionResult: (result) => {
        set({
          logs: result.logs,
          isRunning: false,
          lastOutput: result.output ?? null
        });
      },
      setLastOutput: (payload) => {
        set({ lastOutput: payload });
      }
    }),
    {
      name: "agentic-automation-drafts"
    }
  )
);
