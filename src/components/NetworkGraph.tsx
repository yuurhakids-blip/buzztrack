import React, { useState, useEffect } from 'react';
import { NetworkNode, NetworkLink } from '../types';
import { api } from '../api';
import { Shield, AlertTriangle, Radio, Hash, UserCheck, HelpCircle, ExternalLink } from 'lucide-react';

interface NetworkGraphProps {
  onSelectNode?: (nodeId: string, label: string, botScore?: number) => void;
  reloadTrigger?: number;
  dateRange?: { start: string; end: string };
}

export default function NetworkGraph({ onSelectNode, reloadTrigger, dateRange }: NetworkGraphProps) {
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [links, setLinks] = useState<NetworkLink[]>([]);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<NetworkNode | null>(null);
  const [platformFilter, setPlatformFilter] = useState<string>('All');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const nodeRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.network.get()
      .then(data => {
        if (data.nodes) {
          setNodes(data.nodes);
          setLinks(data.links || []);
          const mainHub = data.nodes.find((n: NetworkNode) => n.id === 'narrative-main');
          if (mainHub) {
            setSelectedNode(mainHub);
          } else if (data.nodes.length > 0) {
            setSelectedNode(data.nodes[0]);
          } else {
            setSelectedNode(null);
          }
        } else {
          setNodes([]);
          setLinks([]);
          setSelectedNode(null);
        }
      })
      .catch(err => {
        console.error("Error pulling central nodes:", err);
        setNodes([]);
        setLinks([]);
        setSelectedNode(null);
      });
  }, [reloadTrigger]);

  // SVG Dimension Constants — larger canvas for expanded coordination map
  const width = 800;
  const height = 500;

  // Manual structured layout positions for nodes to keep them beautiful, balanced, and responsive in React without non-deterministic layout bugs
  const positions: Record<string, { x: number; y: number }> = {
    // Central campaign hub
    'narrative-main': { x: 400, y: 250 },
    // Buzzer masters (3)
    'master-1': { x: 250, y: 180 },
    'master-2': { x: 550, y: 180 },
    'master-3': { x: 400, y: 120 },
    // Hashtag nodes (6)
    'hash-1': { x: 200, y: 340 },
    'hash-2': { x: 600, y: 340 },
    'hash-3': { x: 300, y: 70 },
    'hash-4': { x: 500, y: 70 },
    'hash-5': { x: 130, y: 250 },
    'hash-6': { x: 670, y: 250 },
    // Bot nodes related to X platform (left cluster)
    'bot-1': { x: 80, y: 180 },
    'bot-2': { x: 110, y: 310 },
    'bot-3': { x: 160, y: 420 },
    'bot-4': { x: 200, y: 470 },
    'bot-5': { x: 60, y: 380 },
    'bot-6': { x: 140, y: 130 },
    'bot-7': { x: 270, y: 50 },
    // Bot nodes related to YouTube platform (right cluster)
    'bot-8': { x: 660, y: 130 },
    'bot-9': { x: 640, y: 310 },
    'bot-10': { x: 700, y: 380 },
    'bot-11': { x: 730, y: 180 },
    'bot-12': { x: 580, y: 420 },
    'bot-13': { x: 690, y: 460 },
    // Bot nodes — TikTok / cross-platform (bottom area)
    'bot-14': { x: 330, y: 440 },
    'bot-15': { x: 470, y: 440 },
    'bot-16': { x: 380, y: 370 },
    'bot-17': { x: 520, y: 370 },
    'bot-18': { x: 260, y: 390 },
    'bot-19': { x: 540, y: 480 },
    'bot-20': { x: 420, y: 490 },
    // Platform sub-hubs (X / YouTube / TikTok grouping nodes)
    'platform-x': { x: 130, y: 80 },
    'platform-youtube': { x: 670, y: 80 },
    'platform-tiktok': { x: 400, y: 30 },
  };

  const filteredNodes = nodes.filter(node => {
    if (platformFilter === 'All') return true;
    if (!node.platform) return true; // Keep campaign/hashtag central nodes
    return node.platform === platformFilter;
  });

  const nodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredLinks = links.filter(
    link => nodeIds.has(link.source) && nodeIds.has(link.target)
  );

  const handleNodeClick = (node: NetworkNode) => {
    setSelectedNode(node);
    if (onSelectNode) {
      onSelectNode(node.id, node.label, node.botScore);
    }
  };

  const getGroupColor = (group: string, score?: number, platform?: string) => {
    if (group === 'campaign') return 'fill-indigo-500 stroke-indigo-300';
    if (group === 'platform_hub') {
      if (platform === 'X') return 'fill-sky-500 stroke-sky-300';
      if (platform === 'YouTube') return 'fill-red-500 stroke-red-300';
      if (platform === 'TikTok') return 'fill-cyan-500 stroke-cyan-300';
      return 'fill-purple-500 stroke-purple-300';
    }
    if (group === 'hashtag') return 'fill-teal-500 stroke-teal-300';
    if (group === 'buzzer_master') {
      if (score && score > 80) return 'fill-rose-500 stroke-rose-300';
      return 'fill-orange-400 stroke-orange-200';
    }
    // bot node with platform-flavored fill
    const base = score && score > 90 ? ' fill-red-600 stroke-red-400'
      : score && score > 75 ? ' fill-red-400 stroke-red-200'
      : ' fill-yellow-500 stroke-yellow-300';
    if (platform === 'X') return 'fill-cyan-800 stroke-cyan-500' + base.slice(base.lastIndexOf(';'));
    return base;
  };

  const getIconForGroup = (group: string, score?: number, platform?: string) => {
    if (group === 'campaign') return <Radio className="w-5 h-5 text-indigo-400" />;
    if (group === 'platform_hub') {
      if (platform === 'X') return <span className="text-[10px] font-black text-sky-300">X</span>;
      if (platform === 'YouTube') return <span className="text-[10px] font-black text-red-300">YT</span>;
      if (platform === 'TikTok') return <span className="text-[10px] font-black text-cyan-300">TK</span>;
    }
    if (group === 'hashtag') return <Hash className="w-5 h-5 text-teal-400" />;
    if (group === 'buzzer_master') return <AlertTriangle className="w-5 h-5 text-orange-400" id="icon-warning-master" />;
    if (score && score > 85) return <Shield className="w-5 h-5 text-red-500" />;
    return <UserCheck className="w-5 h-5 text-yellow-400" />;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800 p-6 shadow-2xl overflow-hidden" id="network-container">
      {/* Network Interactive Stage */}
      <div className="lg:col-span-2 relative flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-100 tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></span>
              Live Multiplatform Coordination Map
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Showing linked botnets, topic nodes, and coordinators targeting trending hashtags. Hover on elements to focus connections.
            </p>
          </div>
          <div className="flex gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {['All', 'X', 'TikTok', 'YouTube'].map((plat) => (
              <button
                key={plat}
                id={`btn-filter-${plat.toLowerCase()}`}
                onClick={() => setPlatformFilter(plat)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition ${
                  platformFilter === plat
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {plat}
              </button>
            ))}
          </div>
        </div>

        {/* SVG Drawing Canvas */}
        <div
          ref={nodeRef}
          className="relative w-full bg-slate-950/80 rounded-xl border border-slate-900 overflow-hidden h-[480px] select-none"
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest('svg') || e.target === nodeRef.current) {
              setIsDragging(true);
              setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
            }
          }}
          onMouseMove={(e) => {
            if (isDragging) {
              setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
            }
          }}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <div
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'center center' }}
            className="transition-transform duration-200 flex items-center justify-center"
          >
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="select-none"
            style={{ width, height }}
            id="network-svg"
          >
            {/* Defs for gradients & patterns */}
            <defs>
              <radialGradient id="hubbg" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
              </radialGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Hub ambient glow */}
            <circle cx="400" cy="250" r="180" fill="url(#hubbg)" className="pointer-events-none" />
            <circle cx="130" cy="80" r="60" fill="url(#hubbg)" className="pointer-events-none" opacity="0.5" />
            <circle cx="670" cy="80" r="60" fill="url(#hubbg)" className="pointer-events-none" opacity="0.5" />
            <circle cx="400" cy="30" r="60" fill="url(#hubbg)" className="pointer-events-none" opacity="0.5" />

            {/* Connection Links */}
            {filteredLinks.map((link, idx) => {
              const srcPos = positions[link.source];
              const tgtPos = positions[link.target];
              if (!srcPos || !tgtPos) return null;

              const isLinkHighlighted = 
                (hoveredNode && (hoveredNode.id === link.source || hoveredNode.id === link.target)) ||
                (selectedNode && (selectedNode.id === link.source || selectedNode.id === link.target));

              return (
                <g key={`l-${idx}`}>
                  <line
                    x1={srcPos.x}
                    y1={srcPos.y}
                    x2={tgtPos.x}
                    y2={tgtPos.y}
                    className={`transition-all duration-300 ${
                      isLinkHighlighted 
                        ? 'stroke-indigo-400 stroke-[2.5px] opacity-100' 
                        : 'stroke-slate-800 stroke-[1.2px] opacity-40'
                    }`}
                  />
                  {/* Dynamic pulse along active coordination links */}
                  {isLinkHighlighted && (
                    <circle
                      r="2.5"
                      fill="#818cf8"
                      className="animate-ping"
                      style={{
                        animation: `pulse-travel 6s infinite linear`,
                        cx: `${(srcPos.x + tgtPos.x) / 2}`,
                        cy: `${(srcPos.y + tgtPos.y) / 2}`
                      }}
                    />
                  )}
                </g>
              );
            })}

            {/* Drawing Nodes */}
            {filteredNodes.map((node) => {
              const pos = positions[node.id];
              if (!pos) return null;

              const isSelected = selectedNode?.id === node.id;
              const isHovered = hoveredNode?.id === node.id;
              const isRelated = hoveredNode && links.some(
                l => (l.source === node.id && l.target === hoveredNode.id) || 
                     (l.target === node.id && l.source === hoveredNode.id)
              );

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  className="cursor-pointer"
                  onClick={() => handleNodeClick(node)}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  {/* Outer circle layout glow on selection/hover */}
                  {(isSelected || isHovered) && (
                    <circle
                      r={node.size + 9}
                      className="fill-none stroke-indigo-500/30 stroke-2 animate-pulse"
                      filter="url(#glow)"
                    />
                  )}

                  {/* Node fill body */}
                  <circle
                    r={isSelected ? node.size + 3 : node.size}
                    className={`transition-all duration-300 stroke-[2px] ${getGroupColor(node.group, node.botScore, node.platform)} ${
                      isSelected || isHovered || isRelated ? 'opacity-100' : 'opacity-85'
                    }`}
                  />

                  {/* Interactive inner label or identifier */}
                  {node.group === 'campaign' && (
                    <circle r="4" fill="#ffffff" className="animate-ping" />
                  )}

                  {/* Simple text labels for important nodes */}
                  {(node.size >= 16 || isSelected || isHovered) && (
                    <g transform={`translate(0, -${node.size + 6})`}>
                      <rect
                        x="-45"
                        y="-10"
                        width="90"
                        height="18"
                        rx="4"
                        className="fill-slate-950/90 stroke-slate-800/80 stroke-1 pointer-events-none"
                      />
                      <text
                        textAnchor="middle"
                        className="fill-slate-200 text-[9px] font-semibold font-mono font-medium pointer-events-none"
                        y="2"
                      >
                        {node.label.length > 13 ? `${node.label.substring(0, 11)}..` : node.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
          </div>
          {/* Zoom controls */}
          <div className="absolute top-3 right-3 flex gap-1">
            <button
              onClick={() => setZoom(prev => Math.min(3, prev + 0.2))}
              className="w-7 h-7 bg-slate-950/90 border border-slate-800 rounded text-[11px] text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer flex items-center justify-center font-bold"
              title="Perbesar"
            >+</button>
            <button
              onClick={() => setZoom(prev => Math.max(0.3, prev - 0.2))}
              className="w-7 h-7 bg-slate-950/90 border border-slate-800 rounded text-[11px] text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer flex items-center justify-center font-bold"
              title="Perkecil"
            >−</button>
            <button
              onClick={() => setZoom(1)}
              className="w-7 h-7 bg-slate-950/90 border border-slate-800 rounded text-[9px] text-slate-500 hover:text-white hover:bg-slate-800 transition cursor-pointer flex items-center justify-center font-mono"
              title="Reset zoom"
            >↺</button>
          </div>
          <div className="absolute bottom-3 left-3 flex gap-3 text-[9px] bg-slate-950/95 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-800/80 text-slate-400 font-mono flex-wrap">
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-500"></span> Campaign</div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-400"></span> Master</div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-teal-500"></span> Hashtag</div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"></span> Bot</div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sky-500"></span> X Hub</div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-600"></span> YT Hub</div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-500"></span> TK Hub</div>
          </div>
          <div className="absolute bottom-3 right-3 text-[9px] text-slate-600 font-mono">
            {Math.round(zoom * 100)}%
          </div>
        </div>
      </div>

      {/* Node Details Inspection Panel */}
      <div className="flex flex-col bg-slate-950/60 rounded-xl border border-slate-800/80 p-5 shadow-inner">
        {selectedNode ? (
          <div className="h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className={`text-[10px] uppercase tracking-wider font-semibold font-mono px-2 py-0.5 rounded ${
                  selectedNode.group === 'campaign' ? 'bg-indigo-500/20 text-indigo-400' :
                  selectedNode.group === 'hashtag' ? 'bg-teal-500/20 text-teal-400' :
                  selectedNode.group === 'platform_hub' ? 'bg-purple-500/20 text-purple-400' :
                  'bg-rose-500/20 text-rose-400'
                }`}>
                  {selectedNode.group.replace('_', ' ')}
                </span>
                {selectedNode.platform && (
                  <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded-full">
                    {selectedNode.platform}
                  </span>
                )}
              </div>

              <div className="flex items-start gap-3 mb-4">
                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                  {getIconForGroup(selectedNode.group, selectedNode.botScore)}
                </div>
                <div>
                  <h4 className="text-slate-200 font-bold tracking-tight text-sm">
                    {selectedNode.label}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    ID: <code className="text-slate-500">{selectedNode.id}</code>
                  </p>
                </div>
              </div>

              {/* Bot Probability Meter if applicable */}
              {selectedNode.botScore !== undefined && (
                <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800/60 mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-400 font-medium">Buzzer/Bot Probability</span>
                    <span className={`text-sm font-bold font-mono ${
                      selectedNode.botScore > 80 ? 'text-red-400' :
                      selectedNode.botScore > 50 ? 'text-orange-400' :
                      'text-green-400'
                    }`}>
                      {selectedNode.botScore}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        selectedNode.botScore > 80 ? 'bg-gradient-to-r from-red-500 to-rose-600' :
                        selectedNode.botScore > 50 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' :
                        'bg-gradient-to-r from-emerald-400 to-green-500'
                      }`}
                      style={{ width: `${selectedNode.botScore}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">
                    {selectedNode.botScore > 80 ? 'Extremely high likelihood of dynamic orchestration & programmed deployment.' :
                     selectedNode.botScore > 50 ? 'Moderate anomalous patterns. Exhibits coordinated copy-paste traits.' :
                     'Authentic individual activity model or established human organizer.'}
                  </p>
                </div>
              )}

              {/* Post Content Preview */}
              {selectedNode.postText && (
                <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800/60 mb-4">
                  <h5 className="text-[11px] uppercase tracking-wider font-bold text-slate-400 font-mono mb-2">Postingan Terkait</h5>
                  <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-4 mb-2">{selectedNode.postText}</p>
                  {selectedNode.postUrl && (
                    <a
                      href={selectedNode.postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-mono text-[#D4AF37] hover:text-amber-300 transition"
                    >
                      <ExternalLink className="w-3 h-3" /> Buka postingan asli
                    </a>
                  )}
                </div>
              )}

              {/* Structured Behavior Signals */}
              <div className="space-y-3">
                <h5 className="text-[11px] uppercase tracking-wider font-bold text-slate-400 font-mono">Coordination Diagnostics</h5>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-900 pb-1.5">
                    <span className="text-slate-500">Coordination Delay</span>
                    <span className="text-slate-300 font-mono font-medium">
                      {selectedNode.group === 'campaign' ? 'Macro Focus' : 
                       selectedNode.botScore && selectedNode.botScore > 90 ? '< 1.8 seconds' : '2.4 mins avg'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1.5">
                    <span className="text-slate-500">Network Degree</span>
                    <span className="text-slate-300 font-mono font-medium">
                      {selectedNode.id === 'narrative-main' ? 'Direct Hub (12 Links)' :
                       selectedNode.group === 'hashtag' ? 'Common (4 Links)' : 'Single Amplification Line'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1.5">
                    <span className="text-slate-500">Campaign Affinity</span>
                    <span className="text-slate-300 font-mono font-medium">
                      {selectedNode.group === 'campaign' ? 'Total Coverage' : 'High Corporate/Political Bias'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-900 pb-1.5">
                    <span className="text-slate-500">Deployment Status</span>
                    <span className="text-slate-300 font-mono font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping"></span> Live Broadcast
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-900">
              <p className="text-[10px] text-slate-500 italic">
                💡 Tip: Click on different nodes (red, orange, or teal circles) inside the multi-platform graph to inspect custom cyber-disinformation profiles instantly.
              </p>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col justify-center items-center text-center text-slate-500 py-12">
            <HelpCircle className="w-10 h-10 text-slate-700 stroke-1 mb-2" />
            <p className="text-sm">No node selected</p>
            <p className="text-xs mt-1">Select any point inside the graph map to view threat levels.</p>
          </div>
        )}
      </div>
    </div>
  );
}
