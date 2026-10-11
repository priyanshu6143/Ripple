import React, { useMemo, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Edge,
  Handle,
  MarkerType,
  Node,
  NodeProps,
  Position,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { FileCode2, FlaskConical, ArrowDownRight, ShieldAlert } from 'lucide-react';
import { GraphResponse, ImpactReportResponse } from '../types';

export type NodeImpactRole = 'selected' | 'direct' | 'indirect' | 'imported' | 'neutral';

interface CustomNodeData {
  label: string;
  fullPath: string;
  directory: string;
  language: string;
  isTest: boolean;
  inDegree: number;
  outDegree: number;
  role: NodeImpactRole;
  hopDistance?: number;
}

const FileGraphNode: React.FC<NodeProps<CustomNodeData>> = ({ data }) => {
  const roleStyles: Record<
    NodeImpactRole,
    { border: string; bg: string; badge: string; badgeText: string; ring: string }
  > = {
    selected: {
      border: 'border-sky-400',
      bg: 'bg-gradient-to-br from-sky-950/95 via-slate-900/95 to-indigo-950/90',
      badge: 'bg-sky-500/25 text-sky-200 border-sky-400/50',
      badgeText: 'CHANGED FILE',
      ring: 'ring-2 ring-sky-400/50 shadow-lg shadow-sky-500/25',
    },
    direct: {
      border: 'border-amber-400/90',
      bg: 'bg-gradient-to-br from-amber-950/85 via-slate-900/95 to-slate-900/90',
      badge: 'bg-amber-500/25 text-amber-200 border-amber-400/50',
      badgeText: 'DIRECT IMPACT (1 HOP)',
      ring: 'ring-1 ring-amber-400/40 shadow-md shadow-amber-500/15',
    },
    indirect: {
      border: 'border-purple-400/85',
      bg: 'bg-gradient-to-br from-purple-950/85 via-slate-900/95 to-slate-900/90',
      badge: 'bg-purple-500/25 text-purple-200 border-purple-400/50',
      badgeText: `INDIRECT (${data.hopDistance ?? 2} HOPS)`,
      ring: 'ring-1 ring-purple-400/35 shadow-md shadow-purple-500/15',
    },
    imported: {
      border: 'border-emerald-500/60',
      bg: 'bg-slate-900/95',
      badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
      badgeText: 'IMPORTED BY TARGET',
      ring: '',
    },
    neutral: {
      border: 'border-slate-700/80 hover:border-slate-500',
      bg: 'bg-[#0B1020]/95',
      badge: 'bg-slate-800 text-slate-400 border-slate-700',
      badgeText: data.isTest ? 'TEST SUITE' : data.language.toUpperCase(),
      ring: '',
    },
  };

  const style = roleStyles[data.role];

  return (
    <div
      className={`w-[235px] rounded-xl border ${style.border} ${style.bg} ${style.ring} px-3.5 py-2.5 transition-all duration-200 cursor-pointer select-none`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-slate-400 !border-slate-900"
      />
      <div className="flex items-center justify-between gap-1.5 mb-1.5">
        <span
          className={`px-2 py-0.5 rounded text-[9px] font-mono font-semibold tracking-wider border ${style.badge}`}
        >
          {style.badgeText}
        </span>
        {data.isTest && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <FlaskConical className="w-2.5 h-2.5" />
            Test
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <FileCode2
          className={`w-4 h-4 shrink-0 ${
            data.role === 'selected'
              ? 'text-sky-400'
              : data.role === 'direct'
              ? 'text-amber-400'
              : data.role === 'indirect'
              ? 'text-purple-400'
              : 'text-slate-400'
          }`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-100 truncate" title={data.label}>
            {data.label}
          </p>
          <p className="text-[10px] font-mono text-slate-400 truncate" title={data.fullPath}>
            {data.directory}
          </p>
        </div>
      </div>

      <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
        <span title="Number of files that depend on this file">
          Dependents: <strong className="text-slate-200">{data.inDegree}</strong>
        </span>
        <span title="Number of files this file imports">
          Imports: <strong className="text-slate-200">{data.outDegree}</strong>
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-sky-400 !border-slate-900"
      />
    </div>
  );
};

const nodeTypes = {
  fileNode: FileGraphNode,
};

interface DependencyGraphProps {
  graph: GraphResponse;
  selectedFile: string | null;
  impactReport: ImpactReportResponse | null;
  onSelectFile: (filePath: string) => void;
  showOnlyAffected?: boolean;
}

/**
 * Compute a deterministic layered layout based on topological depth
 * so high-level dependents (controllers/tests) sit in upper rows and
 * foundational dependencies (models/repositories/clients) sit in lower rows.
 */
function computeLayeredLayout(
  graph: GraphResponse,
  visibleNodeIds: Set<string>
): Record<string, { x: number; y: number }> {
  const visibleNodes = graph.nodes.filter((n) => visibleNodeIds.has(n.id));
  const outgoingMap: Record<string, string[]> = {};
  for (const n of visibleNodes) {
    outgoingMap[n.id] = [];
  }
  for (const edge of graph.edges) {
    if (visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)) {
      outgoingMap[edge.source].push(edge.target);
    }
  }

  // Compute depth: files with no imports (foundational models/clients) at bottom layer,
  // or compute level from top (files with in_degree == 0 at top row 0)
  const incomingCount: Record<string, number> = {};
  for (const n of visibleNodes) incomingCount[n.id] = 0;
  for (const edge of graph.edges) {
    if (visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)) {
      incomingCount[edge.target] = (incomingCount[edge.target] || 0) + 1;
    }
  }

  const layerByNode: Record<string, number> = {};
  const queue: string[] = [];

  for (const n of visibleNodes) {
    if (incomingCount[n.id] === 0) {
      layerByNode[n.id] = 0;
      queue.push(n.id);
    }
  }

  // If cycle prevented root detection, seed with first node
  if (queue.length === 0 && visibleNodes.length > 0) {
    layerByNode[visibleNodes[0].id] = 0;
    queue.push(visibleNodes[0].id);
  }

  const visited = new Set<string>(queue);
  while (queue.length > 0) {
    const curr = queue.shift()!;
    const currLayer = layerByNode[curr] ?? 0;
    for (const target of outgoingMap[curr] || []) {
      const nextLayer = Math.min(8, currLayer + 1);
      if (layerByNode[target] === undefined || layerByNode[target] < nextLayer) {
        layerByNode[target] = nextLayer;
      }
      if (!visited.has(target)) {
        visited.add(target);
        queue.push(target);
      }
    }
  }

  for (const n of visibleNodes) {
    if (layerByNode[n.id] === undefined) {
      layerByNode[n.id] = 0;
    }
  }

  // Group nodes by layer
  const layers: Record<number, typeof visibleNodes> = {};
  for (const n of visibleNodes) {
    const l = layerByNode[n.id];
    if (!layers[l]) layers[l] = [];
    layers[l].push(n);
  }

  const positions: Record<string, { x: number; y: number }> = {};
  const sortedLayerKeys = Object.keys(layers)
    .map(Number)
    .sort((a, b) => a - b);

  const X_GAP = 275;
  const Y_GAP = 165;
  const MAX_PER_ROW = 4;

  let currentRowIndex = 0;
  for (const layerKey of sortedLayerKeys) {
    const group = layers[layerKey].sort((a, b) => a.id.localeCompare(b.id));
    for (let i = 0; i < group.length; i += MAX_PER_ROW) {
      const slice = group.slice(i, i + MAX_PER_ROW);
      const rowWidth = (slice.length - 1) * X_GAP;
      const startX = -rowWidth / 2;
      slice.forEach((node, idx) => {
        positions[node.id] = {
          x: startX + idx * X_GAP,
          y: currentRowIndex * Y_GAP,
        };
      });
      currentRowIndex += 1;
    }
  }

  return positions;
}

export const DependencyGraph: React.FC<DependencyGraphProps> = ({
  graph,
  selectedFile,
  impactReport,
  onSelectFile,
  showOnlyAffected = false,
}) => {
  const { computedNodes, computedEdges } = useMemo(() => {
    const directSet = new Set<string>(
      impactReport?.direct_dependents.map((d) => d.file_path) || []
    );
    const indirectMap = new Map<string, number>(
      impactReport?.indirect_dependents.map((d) => [d.file_path, d.distance]) || []
    );
    const importedBySelectedSet = new Set<string>(
      impactReport?.selected_file.imports || []
    );

    // Edges that belong to an active impact propagation path
    const activeImpactEdges = new Set<string>();
    if (impactReport && selectedFile) {
      const affectedNodes = new Set<string>([
        ...impactReport.direct_dependents.map((d) => d.file_path),
        ...impactReport.indirect_dependents.map((d) => d.file_path),
      ]);
      for (const edge of graph.edges) {
        if (
          affectedNodes.has(edge.source) &&
          (edge.target === selectedFile || affectedNodes.has(edge.target))
        ) {
          activeImpactEdges.add(`${edge.source}->${edge.target}`);
        }
      }
    }

    const visibleNodeIds = new Set<string>();
    for (const n of graph.nodes) {
      if (!showOnlyAffected || !selectedFile) {
        visibleNodeIds.add(n.id);
      } else if (
        n.id === selectedFile ||
        directSet.has(n.id) ||
        indirectMap.has(n.id) ||
        importedBySelectedSet.has(n.id)
      ) {
        visibleNodeIds.add(n.id);
      }
    }

    const positions = computeLayeredLayout(graph, visibleNodeIds);

    const rfNodes: Node<CustomNodeData>[] = graph.nodes
      .filter((n) => visibleNodeIds.has(n.id))
      .map((n) => {
        let role: NodeImpactRole = 'neutral';
        let hopDistance: number | undefined = undefined;

        if (selectedFile && n.id === selectedFile) {
          role = 'selected';
        } else if (directSet.has(n.id)) {
          role = 'direct';
          hopDistance = 1;
        } else if (indirectMap.has(n.id)) {
          role = 'indirect';
          hopDistance = indirectMap.get(n.id);
        } else if (importedBySelectedSet.has(n.id)) {
          role = 'imported';
        }

        return {
          id: n.id,
          type: 'fileNode',
          position: positions[n.id] || { x: 0, y: 0 },
          data: {
            label: n.label,
            fullPath: n.id,
            directory: n.directory,
            language: n.language,
            isTest: n.is_test,
            inDegree: n.in_degree,
            outDegree: n.out_degree,
            role,
            hopDistance,
          },
        };
      });

    const rfEdges: Edge[] = graph.edges
      .filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target))
      .map((e) => {
        const key = `${e.source}->${e.target}`;
        const isImpactEdge = activeImpactEdges.has(key);
        const isDirectEdge = selectedFile !== null && e.target === selectedFile;
        const isSelectedOutgoing = selectedFile !== null && e.source === selectedFile;

        let strokeColor = '#334155';
        let strokeWidth = 1.5;
        let animated = false;

        if (isDirectEdge) {
          strokeColor = '#F59E0B'; // Amber for direct dependent edge
          strokeWidth = 2.6;
          animated = true;
        } else if (isImpactEdge) {
          strokeColor = '#A855F7'; // Purple for transitive dependent edge
          strokeWidth = 2.2;
          animated = true;
        } else if (isSelectedOutgoing) {
          strokeColor = '#10B981'; // Emerald for what selected file imports
          strokeWidth = 1.8;
        }

        return {
          id: e.id,
          source: e.source,
          target: e.target,
          animated,
          style: {
            stroke: strokeColor,
            strokeWidth,
            opacity: selectedFile && !isImpactEdge && !isSelectedOutgoing ? 0.3 : 0.95,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: strokeColor,
            width: 18,
            height: 18,
          },
        };
      });

    return { computedNodes: rfNodes, computedEdges: rfEdges };
  }, [graph, selectedFile, impactReport, showOnlyAffected]);

  const [nodes, setNodes, onNodesChange] = useNodesState(computedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(computedEdges);

  useEffect(() => {
    setNodes(computedNodes);
    setEdges(computedEdges);
  }, [computedNodes, computedEdges, setNodes, setEdges]);

  return (
    <div className="relative w-full h-full min-h-[540px] rounded-xl overflow-hidden bg-[#060913] border border-slate-800/90">
      {/* Top Graph Semantics & Legend Bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto flex flex-wrap items-center gap-3 px-3 py-2 rounded-lg bg-[#0B1020]/90 backdrop-blur-md border border-slate-800 text-[11px]">
          <span className="font-semibold text-slate-300 flex items-center gap-1">
            <ArrowDownRight className="w-3.5 h-3.5 text-sky-400" />
            Edge <code className="text-sky-300 font-mono">A → B</code> : A imports B
          </span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-sm shadow-sky-400" />
            Changed File
          </span>
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400" />
            Direct Dependent
          </span>
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-sm shadow-purple-400" />
            Indirect Dependent
          </span>
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            Imported Target
          </span>
        </div>

        {impactReport?.cycle_detected && (
          <div className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/90 border border-rose-500/40 text-rose-200 text-xs">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Circular dependency detected & safely bounded</span>
          </div>
        )}
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onSelectFile(node.id)}
        fitView
        fitViewOptions={{ padding: 0.22 }}
        minZoom={0.2}
        maxZoom={1.75}
      >
        <Background color="#1e293b" gap={22} size={1.2} />
        <Controls position="bottom-right" />
      </ReactFlow>
    </div>
  );
};
