import { memo } from "react";
import type { NodeProps } from "reactflow";
import { Handle, Position } from "reactflow";
import { icons } from "lucide-react";
import type { WorkflowNodeData } from "@/types/workflow";
import { cn } from "@/lib/utils";
import { getTemplateByType } from "@/lib/nodes";

const iconFallback = icons["Workflow"] ?? icons["Sparkle"];

function AutomationNode({ data, selected }: NodeProps<WorkflowNodeData>) {
  const template = getTemplateByType(data.type);
  const Icon =
    (template && icons[template.icon]) || iconFallback;

  return (
    <div
      className={cn(
        "rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 shadow-lg transition-all duration-200",
        selected ? "ring-2 ring-primary shadow-soft" : "hover:border-primary/40",
        template?.accent
          ? `bg-gradient-to-br ${template.accent}`
          : "bg-gradient-to-br from-slate-800/80 to-slate-900/80"
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 border-none bg-primary" />
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 border-none bg-primary" />
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-black/20 p-1.5">
          <Icon className="h-4 w-4 text-white/80" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white/90">{data.label}</p>
          <p className="text-xs text-white/60">{data.description}</p>
        </div>
      </div>
      <NodeConfigPreview type={data.type} config={data.config} />
    </div>
  );
}

function NodeConfigPreview({
  type,
  config
}: {
  type: WorkflowNodeData["type"];
  config: Record<string, any>;
}) {
  switch (type) {
    case "trigger":
      return (
        <div className="mt-3 rounded-lg bg-black/20 p-2 text-xs text-white/70">
          <p className="font-medium uppercase tracking-wide text-emerald-200/80">schedule</p>
          <p>
            {config.mode === "interval"
              ? `Every ${config.interval} seconds`
              : `Cron: ${config.cron}`}
          </p>
        </div>
      );
    case "http":
      return (
        <div className="mt-3 rounded-lg bg-black/20 p-2 text-xs text-white/70">
          <p className="font-medium uppercase tracking-wide text-sky-200/80">{config.method}</p>
          <p className="truncate">{config.url}</p>
        </div>
      );
    case "ai":
      return (
        <div className="mt-3 rounded-lg bg-black/20 p-2 text-xs text-white/70">
          <p className="font-medium uppercase tracking-wide text-amber-200/80">
            {config.provider}
          </p>
          <p className="truncate">{config.model}</p>
        </div>
      );
    case "transform":
      return (
        <div className="mt-3 rounded-lg bg-black/20 p-2 text-xs text-white/70">
          <p className="font-medium uppercase tracking-wide text-purple-200/80">snippet</p>
          <p className="truncate">{config.snippet.split("\n")[0]}</p>
        </div>
      );
    case "delay":
      return (
        <div className="mt-3 rounded-lg bg-black/20 p-2 text-xs text-white/70">
          <p className="font-medium uppercase tracking-wide text-blue-200/80">wait</p>
          <p>{config.duration} ms</p>
        </div>
      );
    case "webhook":
      return (
        <div className="mt-3 rounded-lg bg-black/20 p-2 text-xs text-white/70">
          <p className="font-medium uppercase tracking-wide text-rose-200/80">
            status {config.status}
          </p>
          <p>Respond with payload</p>
        </div>
      );
    default:
      return null;
  }
}

export default memo(AutomationNode);
