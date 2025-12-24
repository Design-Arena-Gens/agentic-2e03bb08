"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow
} from "reactflow";
import "reactflow/dist/style.css";
import { icons } from "lucide-react";
import { toast } from "sonner";
import { executeWorkflow } from "@/lib/executor";
import { NODE_TEMPLATES, createNodeFromTemplate } from "@/lib/nodes";
import AutomationNode from "@/components/nodes/AutomationNode";
import { useWorkflowStore } from "@/store/workflow-store";
import type { RunLogEntry, WorkflowDraft, WorkflowNode } from "@/types/workflow";
import { cn, formatTimestamp, nanoid } from "@/lib/utils";

const nodeTypes = { automationNode: AutomationNode };

export function WorkflowBuilder() {
  return (
    <ReactFlowProvider>
      <BuilderInner />
    </ReactFlowProvider>
  );
}

function BuilderInner() {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const onNodesChange = useWorkflowStore((state) => state.onNodesChange);
  const onEdgesChange = useWorkflowStore((state) => state.onEdgesChange);
  const onConnect = useWorkflowStore((state) => state.onConnect);
  const addNode = useWorkflowStore((state) => state.addNode);
  const setSelectedNode = useWorkflowStore((state) => state.setSelectedNode);
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId);
  const updateNode = useWorkflowStore((state) => state.updateNode);
  const removeNode = useWorkflowStore((state) => state.removeNode);
  const isRunning = useWorkflowStore((state) => state.isRunning);
  const setRunning = useWorkflowStore((state) => state.setRunning);
  const clearLogs = useWorkflowStore((state) => state.clearLogs);
  const addLog = useWorkflowStore((state) => state.addLog);
  const updateExecutionResult = useWorkflowStore((state) => state.updateExecutionResult);
  const logs = useWorkflowStore((state) => state.logs);
  const lastOutput = useWorkflowStore((state) => state.lastOutput);
  const setLastOutput = useWorkflowStore((state) => state.setLastOutput);
  const drafts = useWorkflowStore((state) => state.drafts);
  const loadDraft = useWorkflowStore((state) => state.loadDraft);
  const upsertDraft = useWorkflowStore((state) => state.upsertDraft);
  const deleteDraft = useWorkflowStore((state) => state.deleteDraft);
  const activeWorkflowId = useWorkflowStore((state) => state.activeWorkflowId);

  const [initialised, setInitialised] = useState(false);
  const { project } = useReactFlow();

  useEffect(() => {
    if (initialised) return;

    setInitialised(true);
    if (nodes.length === 0) {
      const trigger = createNodeFromTemplate("trigger", { x: 0, y: 0 });
      const http = createNodeFromTemplate("http", { x: 280, y: 0 });
      const transform = createNodeFromTemplate("transform", { x: 560, y: 0 });
      const ai = createNodeFromTemplate("ai", { x: 840, y: 0 });

      addNode(trigger);
      addNode(http);
      addNode(transform);
      addNode(ai);
      onConnect({
        source: trigger.id,
        sourceHandle: null,
        target: http.id,
        targetHandle: null
      });
      onConnect({
        source: http.id,
        sourceHandle: null,
        target: transform.id,
        targetHandle: null
      });
      onConnect({
        source: transform.id,
        sourceHandle: null,
        target: ai.id,
        targetHandle: null
      });
    }
  }, [addNode, initialised, nodes.length, onConnect]);

  const handleAddNode = useCallback(
    (type: WorkflowNode["data"]["type"]) => {
      const position = project({
        x: 220 + Math.random() * 120,
        y: 160 + nodes.length * 40
      });

      const node = createNodeFromTemplate(type, position);
      addNode(node);
      setSelectedNode(node.id);
    },
    [addNode, nodes.length, project, setSelectedNode]
  );

  const handleRun = useCallback(async () => {
    if (nodes.length === 0) {
      toast.error("Add at least one node before running the workflow.");
      return;
    }

    setRunning(true);
    clearLogs();
    setLastOutput(null);

    try {
      const result = await executeWorkflow(nodes, edges, {
        onLog: addLog
      });

      updateExecutionResult(result);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Workflow executed successfully.");
      }
    } catch (error) {
      setRunning(false);
      toast.error(
        error instanceof Error ? error.message : "Failed to execute workflow."
      );
    }
  }, [addLog, clearLogs, edges, nodes, setLastOutput, setRunning, updateExecutionResult]);

  const handleSaveDraft = useCallback(() => {
    const id = upsertDraft({
      name:
        drafts.find((draft) => draft.id === activeWorkflowId)?.name ??
        `Workflow ${new Date().toLocaleTimeString()}`,
      nodes,
      edges
    });

    toast.success("Workflow saved to your library.", {
      description: `Draft ID: ${id}`
    });
  }, [activeWorkflowId, drafts, edges, nodes, upsertDraft]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <BuilderHeader
        isRunning={isRunning}
        onRun={handleRun}
        onSave={handleSaveDraft}
        drafts={drafts}
        onSelectDraft={loadDraft}
        onDeleteDraft={deleteDraft}
        activeDraftId={activeWorkflowId}
      />
      <div className="flex flex-1 overflow-hidden">
        <NodeLibrary onAdd={handleAddNode} />
        <div className="relative flex flex-1 flex-col">
          <CanvasToolbar />
          <div className="relative flex-1">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onSelectionChange={({ nodes: selection }) =>
                setSelectedNode(selection?.[0]?.id)
              }
              selectionMode={SelectionMode.Partial}
              onPaneClick={() => setSelectedNode(undefined)}
              fitView
              fitViewOptions={{ padding: 0.2 }}
            >
              <MiniMap
                nodeStrokeColor={() => "#60a5fa"}
                nodeColor={() => "#0f172a"}
              />
              <Controls position="top-right" />
              <Background gap={16} color="#1e293b" />
            </ReactFlow>
          </div>
          <ExecutionPanel logs={logs} output={lastOutput} />
        </div>
        <InspectorPanel
          selectedNodeId={selectedNodeId}
          onUpdate={updateNode}
          onRemove={removeNode}
        />
      </div>
    </div>
  );
}

function BuilderHeader({
  isRunning,
  onRun,
  onSave,
  drafts,
  onSelectDraft,
  onDeleteDraft,
  activeDraftId
}: {
  isRunning: boolean;
  onRun: () => void;
  onSave: () => void;
  drafts: WorkflowDraft[];
  onSelectDraft: (id: string) => void;
  onDeleteDraft: (id: string) => void;
  activeDraftId?: string;
}) {
  const Play = icons["Play"];
  const Save = icons["Save"];
  const Sparkle = icons["Sparkle"];
  const Trash = icons["Trash2"];

  return (
    <header className="glass relative flex items-center justify-between border-b border-white/10 px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300">
          <Sparkle className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">
            Agentic Automation Studio
          </h1>
          <p className="text-sm text-slate-300">
            Build free, n8n-inspired agent workflows in your browser.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-sky-500/60 hover:text-white"
          onClick={onSave}
        >
          <Save className="h-4 w-4" />
          Save Draft
        </button>
        <button
          className={cn(
            "inline-flex items-center gap-2 rounded-lg bg-sky-500 px-5 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-sky-400",
            isRunning && "cursor-not-allowed opacity-80"
          )}
          onClick={onRun}
          disabled={isRunning}
        >
          <Play className="h-4 w-4" />
          {isRunning ? "Running..." : "Run Workflow"}
        </button>
      </div>
      {drafts.length > 0 && (
        <div className="absolute right-6 top-full mt-2 flex gap-2">
          <div className="rounded-lg border border-white/10 bg-slate-900/90 p-3 text-sm text-slate-200 shadow-lg">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Your drafts
            </p>
            <ul className="flex flex-col gap-2">
              {drafts.map((draft) => (
                <li key={draft.id} className="flex items-center justify-between gap-2">
                  <button
                    className={cn(
                      "flex flex-1 flex-col rounded-md border px-3 py-2 text-left transition",
                      draft.id === activeDraftId
                        ? "border-sky-500/60 bg-sky-500/10 text-white"
                        : "border-white/10 bg-white/5 hover:border-sky-500/60 hover:bg-white/10"
                    )}
                    onClick={() => onSelectDraft(draft.id)}
                  >
                    <span className="text-sm font-semibold">{draft.name}</span>
                    <span className="text-xs text-slate-300">
                      Updated {new Date(draft.updatedAt).toLocaleString()}
                    </span>
                  </button>
                  <button
                    className="rounded-md border border-white/10 p-2 text-slate-400 transition hover:border-rose-500/50 hover:text-rose-300"
                    onClick={() => onDeleteDraft(draft.id)}
                    aria-label={`Delete ${draft.name}`}
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </header>
  );
}

function NodeLibrary({
  onAdd
}: {
  onAdd: (type: WorkflowNode["data"]["type"]) => void;
}) {
  return (
    <aside className="w-72 overflow-y-auto border-r border-white/10 bg-slate-950/90 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Node Library
      </h2>
      <div className="flex flex-col gap-3">
        {NODE_TEMPLATES.map((template) => {
          const Icon = icons[template.icon];
          return (
            <button
              key={template.type}
              className={cn(
                "rounded-xl border border-white/10 p-4 text-left transition hover:border-sky-500/50 hover:shadow-soft",
                `bg-gradient-to-br ${template.accent}`
              )}
              onClick={() => onAdd(template.type)}
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-black/20 p-2">
                  <Icon className="h-5 w-5 text-white/90" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/90">
                    {template.title}
                  </p>
                  <p className="text-xs text-white/70">{template.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function CanvasToolbar() {
  const Share = icons["Share2"];
  const Wand = icons["Sparkles"];
  const Download = icons["Download"];

  const handleShare = useCallback(async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Share link copied to clipboard.");
  }, []);

  const handleSnapshot = useCallback(async () => {
    const canvas = document.querySelector(".react-flow__viewport") as HTMLElement | null;
    if (!canvas) return;
    const html = canvas.outerHTML;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `workflow-${nanoid()}.html`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Canvas snapshot exported.");
  }, []);

  return (
    <div className="pointer-events-auto absolute left-1/2 top-6 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-slate-900/90 px-4 py-2 shadow-lg">
      <button
        className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-sky-500/60 hover:text-white"
        onClick={handleShare}
      >
        <Share className="h-4 w-4" />
        Share
      </button>
      <button
        className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-sky-500/60 hover:text-white"
        onClick={handleSnapshot}
      >
        <Download className="h-4 w-4" />
        Export HTML
      </button>
      <button
        className="flex items-center gap-2 rounded-full border border-primary/40 bg-primary/20 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-primary/70 hover:bg-primary/30"
        onClick={() =>
          toast.info("Auto-mapping coming soon, stay tuned!", {
            description:
              "We are working on agentic auto-layout to connect compatible nodes automatically."
          })
        }
      >
        <Wand className="h-4 w-4" />
        Auto-map
      </button>
    </div>
  );
}

function InspectorPanel({
  selectedNodeId,
  onUpdate,
  onRemove
}: {
  selectedNodeId?: string;
  onUpdate: (id: string, node: Partial<WorkflowNode>) => void;
  onRemove: (id: string) => void;
}) {
  const node = useWorkflowStore(
    useCallback(
      (state) => state.nodes.find((item) => item.id === selectedNodeId),
      [selectedNodeId]
    )
  );

  const handleConfigChange = useCallback(
    (key: string, value: any) => {
      if (!node) return;
      onUpdate(node.id, {
        data: {
          ...node.data,
          config: {
            ...node.data.config,
            [key]: value
          }
        }
      });
    },
    [node, onUpdate]
  );

  if (!node) {
    return (
      <aside className="w-80 border-l border-white/10 bg-slate-950/90 p-4 text-sm text-slate-300">
        <p className="text-sm font-semibold text-slate-200">Inspector</p>
        <p className="mt-2 text-xs text-slate-400">
          Select a node on the canvas to view and edit its configuration.
        </p>
      </aside>
    );
  }

  return (
    <aside className="w-80 overflow-y-auto border-l border-white/10 bg-slate-950/90 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-white">{node.data.label}</p>
          <p className="text-xs text-slate-400">{node.data.description}</p>
        </div>
        <button
          className="rounded-md border border-rose-500/40 px-2 py-1 text-xs font-medium text-rose-200 transition hover:border-rose-500 hover:text-rose-100"
          onClick={() => onRemove(node.id)}
        >
          Delete
        </button>
      </div>
      <div className="mt-4 space-y-4 text-sm text-slate-200">
        {renderInspectorFields(node, handleConfigChange)}
      </div>
    </aside>
  );
}

function renderInspectorFields(
  node: WorkflowNode,
  handleConfigChange: (key: string, value: any) => void
) {
  switch (node.data.type) {
    case "trigger":
      return (
        <>
          <div>
            <label className="block text-xs uppercase text-slate-400">
              Mode
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm"
              value={node.data.config.mode}
              onChange={(event) =>
                handleConfigChange("mode", event.target.value)
              }
            >
              <option value="interval">Interval</option>
              <option value="cron">Cron</option>
            </select>
          </div>
          {node.data.config.mode === "interval" ? (
            <div>
              <label className="block text-xs uppercase text-slate-400">
                Interval (seconds)
              </label>
              <input
                type="number"
                min={5}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm"
                value={node.data.config.interval}
                onChange={(event) =>
                  handleConfigChange("interval", Number(event.target.value))
                }
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs uppercase text-slate-400">
                Cron Expression
              </label>
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm"
                value={node.data.config.cron}
                onChange={(event) =>
                  handleConfigChange("cron", event.target.value)
                }
              />
            </div>
          )}
        </>
      );
    case "http":
      return (
        <>
          <div>
            <label className="block text-xs uppercase text-slate-400">
              Method
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm"
              value={node.data.config.method}
              onChange={(event) =>
                handleConfigChange("method", event.target.value)
              }
            >
              {["GET", "POST", "PUT", "PATCH", "DELETE"].map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase text-slate-400">
              URL
            </label>
            <input
              type="url"
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm"
              value={node.data.config.url}
              onChange={(event) =>
                handleConfigChange("url", event.target.value)
              }
            />
            <p className="mt-1 text-xs text-slate-400">
              Use {"{{ payload.someField }}"} to inject values.
            </p>
          </div>
          <div>
            <label className="block text-xs uppercase text-slate-400">
              Headers
            </label>
            <div className="mt-1 space-y-2">
              {node.data.config.headers?.map(
                (header: { key: string; value: string }, index: number) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Key"
                      className="w-1/2 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm"
                      value={header.key}
                      onChange={(event) => {
                        const headers = [...node.data.config.headers];
                        headers[index] = {
                          ...headers[index],
                          key: event.target.value
                        };
                        handleConfigChange("headers", headers);
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Value"
                      className="w-1/2 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm"
                      value={header.value}
                      onChange={(event) => {
                        const headers = [...node.data.config.headers];
                        headers[index] = {
                          ...headers[index],
                          value: event.target.value
                        };
                        handleConfigChange("headers", headers);
                      }}
                    />
                  </div>
                )
              )}
              <button
                className="text-xs font-medium text-sky-400 transition hover:text-sky-200"
                onClick={() =>
                  handleConfigChange("headers", [
                    ...(node.data.config.headers ?? []),
                    { key: "", value: "" }
                  ])
                }
              >
                + Add header
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase text-slate-400">
              Body
            </label>
            <textarea
              className="mt-1 h-32 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm font-mono"
              value={node.data.config.body}
              onChange={(event) =>
                handleConfigChange("body", event.target.value)
              }
            />
          </div>
        </>
      );
    case "transform":
      return (
        <div>
          <label className="block text-xs uppercase text-slate-400">
            JavaScript Snippet
          </label>
          <textarea
            className="mt-1 h-48 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm font-mono"
            value={node.data.config.snippet}
            onChange={(event) =>
              handleConfigChange("snippet", event.target.value)
            }
          />
          <p className="mt-2 text-xs text-slate-400">
            Return an object. `payload` contains the previous node output.
          </p>
        </div>
      );
    case "ai":
      return (
        <>
          <div>
            <label className="block text-xs uppercase text-slate-400">
              Provider
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm"
              value={node.data.config.provider}
              onChange={(event) =>
                handleConfigChange("provider", event.target.value)
              }
            >
              <option value="openrouter">OpenRouter</option>
              <option value="openai">OpenAI</option>
              <option value="local">Local Fallback</option>
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase text-slate-400">
              Model
            </label>
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm"
              value={node.data.config.model}
              onChange={(event) =>
                handleConfigChange("model", event.target.value)
              }
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-slate-400">
              Prompt
            </label>
            <textarea
              className="mt-1 h-36 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm font-mono"
              value={node.data.config.prompt}
              onChange={(event) =>
                handleConfigChange("prompt", event.target.value)
              }
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-slate-400">
              Temperature
            </label>
            <input
              type="number"
              step={0.1}
              min={0}
              max={2}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm"
              value={node.data.config.temperature}
              onChange={(event) =>
                handleConfigChange("temperature", Number(event.target.value))
              }
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-slate-400">
              API Key (stored locally)
            </label>
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm"
              value={node.data.config.apiKey}
              onChange={(event) =>
                handleConfigChange("apiKey", event.target.value)
              }
            />
          </div>
        </>
      );
    case "delay":
      return (
        <div>
          <label className="block text-xs uppercase text-slate-400">
            Duration (ms)
          </label>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm"
            value={node.data.config.duration}
            onChange={(event) =>
              handleConfigChange("duration", Number(event.target.value))
            }
          />
        </div>
      );
    case "webhook":
      return (
        <>
          <div>
            <label className="block text-xs uppercase text-slate-400">
              Status Code
            </label>
            <input
              type="number"
              min={100}
              max={599}
              className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm"
              value={node.data.config.status}
              onChange={(event) =>
                handleConfigChange("status", Number(event.target.value))
              }
            />
          </div>
          <div>
            <label className="block text-xs uppercase text-slate-400">
              Response Headers
            </label>
            <textarea
              className="mt-1 h-24 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm font-mono"
              value={JSON.stringify(node.data.config.headers, null, 2)}
              onChange={(event) => {
                try {
                  const parsed = JSON.parse(event.target.value);
                  handleConfigChange("headers", parsed);
                } catch {
                  toast.error("Headers must be a valid JSON object.");
                }
              }}
            />
          </div>
        </>
      );
    default:
      return null;
  }
}

function ExecutionPanel({
  logs,
  output
}: {
  logs: RunLogEntry[];
  output: Record<string, any> | null;
}) {
  const Terminal = icons["Terminal"];
  const FileOutput = icons["FileOutput"];

  return (
    <section className="glass border-t border-white/10 bg-slate-950/70">
      <div className="grid grid-cols-2 gap-4 px-5 py-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <Terminal className="h-4 w-4" />
            Execution Logs
          </div>
          <div className="h-40 overflow-y-auto rounded-lg border border-white/10 bg-black/40 p-3 text-xs font-mono text-slate-200">
            {logs.length === 0 ? (
              <p className="text-slate-500">
                Run the workflow to view step-by-step execution details.
              </p>
            ) : (
              <ul className="space-y-2">
                {logs.map((log) => (
                  <li
                    key={`${log.nodeId}-${log.timestamp}`}
                    className={cn(
                      "rounded-md border p-2",
                      log.status === "error"
                        ? "border-rose-500/50 bg-rose-500/10 text-rose-100"
                        : log.status === "success"
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                          : "border-sky-500/40 bg-sky-500/10 text-sky-100"
                    )}
                  >
                    <p className="font-semibold">{log.nodeLabel}</p>
                    <p className="text-[11px] uppercase tracking-wide">
                      {log.status} • {formatTimestamp(log.timestamp)}
                    </p>
                    <p className="mt-1 text-xs">{log.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <FileOutput className="h-4 w-4" />
            Workflow Output
          </div>
          <div className="h-40 overflow-y-auto rounded-lg border border-white/10 bg-black/40 p-3 text-xs font-mono text-slate-200">
            {output ? (
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(output, null, 2)}
              </pre>
            ) : (
              <p className="text-slate-500">
                Output from the latest run will show up here.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default WorkflowBuilder;
