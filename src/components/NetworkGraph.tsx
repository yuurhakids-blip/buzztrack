import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { NetworkNode, NetworkLink } from '../core/domain/entities/index.ts';
import { api } from '../api';
import { HelpCircle, ExternalLink, BrainCircuit, RefreshCw } from 'lucide-react';
import { AIService } from '../infrastructure/services/AIService';

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
  const [isClustering, setIsClustering] = useState(false);
  const [clusteringMode, setClusteringMode] = useState<'AI' | 'Heuristic' | null>(null);
  const nodeRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = nodeRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomSensitivity = 0.001;
      let newZoom = zoom - e.deltaY * zoomSensitivity;
      newZoom = Math.max(0.3, Math.min(3, newZoom));
      
      if (newZoom !== zoom) {
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const contentX = (mouseX - pan.x) / zoom;
        const contentY = (mouseY - pan.y) / zoom;
        
        const newPanX = mouseX - contentX * newZoom;
        const newPanY = mouseY - contentY * newZoom;
        
        setZoom(newZoom);
        setPan({ x: newPanX, y: newPanY });
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [zoom, pan]);

  const runClustering = async () => {
    if (nodes.length === 0) return;
    setIsClustering(true);
    try {
      const provider = (localStorage.getItem('selectedProvider') as any) || 'Gemini';
      const config = {
        provider,
        model: localStorage.getItem('selectedModel') || 'gemini-1.5-flash',
        apiKey: localStorage.getItem(`api-key-${provider}`) || ''
      };
      
      const result = await AIService.clusterNetwork(nodes, links, config, platformFilter);
      setClusteringMode(result.mode);
      
      if (result && result.clusters) {
        const clusterMap: Record<string, string> = {};
        result.clusters.forEach((c: any) => {
          c.nodeIds.forEach((id: string) => clusterMap[id] = c.clusterId);
        });
        
        setNodes(prev => prev.map(n => ({
          ...n,
          clusterId: clusterMap[n.id] || undefined
        })));
        console.log(`${result.mode} Clustering Success:`, result.clusters);
      }
    } catch (err) {
      console.error("Clustering failed:", err);
      setClusteringMode('Heuristic');
    } finally {
      setIsClustering(false);
    }
  };

  useEffect(() => {
    api.network.get()
      .then(data => {
        if (data.nodes) {
          const groups = [...new Set(data.nodes.map((n: NetworkNode) => n.group))];
          console.log('[NetworkGraph] groups:', groups, 'count:', data.nodes.length);
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

  // SVG Dimension Constants
  const width = 1200;
  const height = 850;

  // Force-directed layout: nodes repel, edges attract, settles into organic shape
  const computedPositions = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {};
    const vel: Record<string, { x: number; y: number }> = {};
    const nodeIds = nodes.map(n => n.id);
    if (nodeIds.length === 0) return pos;

    // Initialize in a centered cloud
    const angleStep = (2 * Math.PI) / nodeIds.length;
    nodeIds.forEach((id, i) => {
      pos[id] = { x: width / 2 + 160 * Math.cos(angleStep * i), y: height / 2 + 100 * Math.sin(angleStep * i) };
      vel[id] = { x: 0, y: 0 };
    });

    const REP = 6000;    // repulsion strength
    const ATT = 0.005;   // attraction strength
    const GRAV = 0.001;  // center gravity
    const DAMP = 0.85;   // velocity damping
    const MIN_D = 30;    // minimum distance

    for (let iter = 0; iter < 150; iter++) {
      // Reset forces
      const forces: Record<string, { x: number; y: number }> = {};
      nodeIds.forEach(id => { forces[id] = { x: 0, y: 0 }; });

      // Repulsion between all pairs
      for (let i = 0; i < nodeIds.length; i++) {
        for (let j = i + 1; j < nodeIds.length; j++) {
          const a = nodeIds[i], b = nodeIds[j];
          let dx = pos[b].x - pos[a].x;
          let dy = pos[b].y - pos[a].y;
          let dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MIN_D) dist = MIN_D;
          const force = REP / (dist * dist);
          const fx = force * (dx / dist);
          const fy = force * (dy / dist);
          forces[a].x -= fx; forces[a].y -= fy;
          forces[b].x += fx; forces[b].y += fy;
        }
      }

      // Attraction along edges
      links.forEach(l => {
        const src = typeof l.source === 'string' ? l.source : l.source.id;
        const tgt = typeof l.target === 'string' ? l.target : l.target.id;
        if (!pos[src] || !pos[tgt]) return;
        let dx = pos[tgt].x - pos[src].x;
        let dy = pos[tgt].y - pos[src].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const force = ATT * Math.max(0, dist - 150);
        const fx = force * (dx / (dist || 1));
        const fy = force * (dy / (dist || 1));
        forces[src].x += fx; forces[src].y += fy;
        forces[tgt].x -= fx; forces[tgt].y -= fy;
      });

      // Center gravity
      nodeIds.forEach(id => {
        forces[id].x += GRAV * (width / 2 - pos[id].x);
        forces[id].y += GRAV * (height / 2 - pos[id].y);
      });

      // Apply forces with damping
      nodeIds.forEach(id => {
        vel[id].x = (vel[id].x + forces[id].x) * DAMP;
        vel[id].y = (vel[id].y + forces[id].y) * DAMP;
        pos[id].x += vel[id].x;
        pos[id].y += vel[id].y;
        // Clamp to canvas
        pos[id].x = Math.max(40, Math.min(width - 40, pos[id].x));
        pos[id].y = Math.max(40, Math.min(height - 40, pos[id].y));
      });
    }

    return pos;
  }, [nodes, links]);

  const getNodePosition = useCallback((node: NetworkNode): { x: number; y: number } | null => {
    return computedPositions[node.id] || null;
  }, [computedPositions]);

  const filteredNodes = nodes.filter(node => {
    if (platformFilter === 'All') return true;
    if (!node.platform) return true;
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

  // High-contrast intuitive palette — brand-accurate for platforms, distinct for actors
  const groupColors = {
    campaign: { fill: '#FFC107', stroke: '#FFE082' },
    platform_x: { fill: '#1DA1F2', stroke: '#6CBDF5' },
    platform_youtube: { fill: '#FF0000', stroke: '#FF5353' },
    platform_tiktok: { fill: '#00F2EA', stroke: '#4DF8F0' },
    hashtag: { fill: '#84CC16', stroke: '#A3E635' },
    buzzer_master: { fill: '#D946EF', stroke: '#E879F9' },
    buzzer_high: { fill: '#F97316', stroke: '#FB923C' },
    buzzer_med: { fill: '#EAB308', stroke: '#FACC15' },
    buzzer_low: { fill: '#64748B', stroke: '#94A3B8' },
  };

  const getGroupStyle = (group: string, score?: number, platform?: string) => {
    if (group === 'campaign') return groupColors.campaign;
    if (group === 'platform_hub') {
      if (platform === 'X') return groupColors.platform_x;
      if (platform === 'YouTube') return groupColors.platform_youtube;
      if (platform === 'TikTok') return groupColors.platform_tiktok;
      return { fill: '#888888', stroke: '#AAAAAA' };
    }
    if (group === 'hashtag') return groupColors.hashtag;
    if (group === 'buzzer_master') return groupColors.buzzer_master;
    if (group === 'buzzer') {
      if (score && score > 80) return groupColors.buzzer_high;
      if (score && score > 50) return groupColors.buzzer_med;
      return groupColors.buzzer_low;
    }
    return { fill: '#888888', stroke: '#AAAAAA' };
  };

  // Mini SVG shapes matching actual node shapes — used in both legend & detail panel
  const MiniNodeShape = ({ group, fill, stroke, size = 20, platform }: { group: string; fill: string; stroke: string; size?: number; platform?: string }) => {
    const s = size / 2;
    if (group === 'campaign') return (
      <svg width={size} height={size} viewBox="0 0 22 22">
        <circle cx="11" cy="11" r="9" fill={fill} stroke={stroke} strokeWidth="2" />
        <circle cx="11" cy="11" r="5" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" />
        <circle cx="11" cy="11" r="2.5" fill="#fff" />
      </svg>
    );
    if (group === 'platform_hub') {
      const letter = platform === 'X' ? 'X' : platform === 'YouTube' ? 'YT' : platform === 'TikTok' ? 'TK' : '?';
      return (
        <svg width={size} height={size} viewBox="0 0 22 22">
          <polygon points="11,2 20,11 11,20 2,11" fill={fill} stroke={stroke} strokeWidth="2" />
          <text x="11" y="13" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#fff" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{letter}</text>
        </svg>
      );
    }
    if (group === 'hashtag') return (
      <svg width={size} height={size} viewBox="0 0 22 22">
        <rect x="2.5" y="2.5" width="17" height="17" rx="4" fill={fill} stroke={stroke} strokeWidth="2" />
        <text x="11" y="14" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#fff">#</text>
      </svg>
    );
    if (group === 'buzzer_master') return (
      <svg width={size} height={size} viewBox="0 0 22 22">
        <polygon points="11,2 20,20 2,20" fill={fill} stroke={stroke} strokeWidth="2" />
        <text x="11" y="15" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#fff">!</text>
      </svg>
    );
    if (group === 'buzzer') return (
      <svg width={size} height={size} viewBox="0 0 22 22">
        <circle cx="11" cy="11" r="8.5" fill={fill} stroke={stroke} strokeWidth="2" strokeDasharray="3 2.5" />
      </svg>
    );
    return <svg width={size} height={size} viewBox="0 0 22 22"><circle cx="11" cy="11" r="8" fill={fill} /></svg>;
  };

  const legendItems: any[] = [
    { key: 'NARASI', isHeader: true },
    { key: 'Campaign', group: 'campaign', ...groupColors.campaign, desc: 'Pusat kampanye', platform: '' },
    { key: 'Hashtag', group: 'hashtag', ...groupColors.hashtag, desc: 'Topik yg dimanfaatkan', platform: '' },
    { key: 'PLATFORM', isHeader: true },
    { key: 'X Hub', group: 'platform_hub', ...groupColors.platform_x, desc: 'X / Twitter', platform: 'X' },
    { key: 'YT Hub', group: 'platform_hub', ...groupColors.platform_youtube, desc: 'YouTube', platform: 'YouTube' },
    { key: 'TK Hub', group: 'platform_hub', ...groupColors.platform_tiktok, desc: 'TikTok', platform: 'TikTok' },
    { key: 'AKTOR', isHeader: true },
    { key: 'Master', group: 'buzzer_master', ...groupColors.buzzer_master, desc: 'Orkestrator', platform: '' },
    { key: 'Buzzer >80', group: 'buzzer', ...groupColors.buzzer_high, desc: 'Skor tinggi', platform: '' },
    { key: 'Buzzer 50-80', group: 'buzzer', ...groupColors.buzzer_med, desc: 'Skor sedang', platform: '' },
    { key: 'Buzzer <50', group: 'buzzer', ...groupColors.buzzer_low, desc: 'Skor rendah', platform: '' },
  ];

  const GroupMiniShape = ({ group, fill, stroke, platform }: { group: string; fill: string; stroke: string; platform?: string }) => (
    <MiniNodeShape group={group} fill={fill} stroke={stroke} platform={platform} />
  );

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
              Showing linked buzzer networks, topic nodes, and coordinators targeting trending hashtags. Hover on elements to focus connections.
            </p>
          </div>
            <div className="flex gap-2 items-center">
              <button
                onClick={runClustering}
                disabled={isClustering}
                className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono font-bold rounded-lg border transition ${
                  isClustering 
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 animate-pulse' 
                    : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20'
                }`}
              >
                {isClustering ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <BrainCircuit className="w-3.5 h-3.5" />}
                {isClustering ? 'AI ANALYSING...' : 'AI CLUSTER GRAPH'}
              </button>
              {clusteringMode && (
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono font-bold ${
                  clusteringMode === 'AI' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  Mode: {clusteringMode}
                </span>
              )}
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
        </div>

        {/* SVG Drawing Canvas */}
        <div
          ref={nodeRef}
          className="relative w-full bg-slate-950/80 rounded-xl border border-slate-900 overflow-hidden h-[700px] select-none"
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
            className="flex items-center justify-center"
          >
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="select-none"
            style={{ width, height }}
            id="network-svg"
          >
            {/* Defs */}
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>



            {/* Connection Links */}
            {filteredLinks.map((link, idx) => {
              const srcNode = nodes.find(n => n.id === link.source);
              const tgtNode = nodes.find(n => n.id === link.target);
              const srcPos = srcNode ? getNodePosition(srcNode) : null;
              const tgtPos = tgtNode ? getNodePosition(tgtNode) : null;
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
              const pos = getNodePosition(node);
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

                  {/* Node fill body — distinct shapes per group */}
                  {(() => {
                    const c = getGroupStyle(node.group, node.botScore, node.platform);
                    const r = isSelected ? Math.max(node.size, 10) + 4 : Math.max(node.size, 8);
                    const opacity = isSelected || isHovered || isRelated ? '1' : '0.85';

                    if (node.group === 'campaign') {
                      // Concentric circle for campaign/narrative hubs
                      return (
                        <g opacity={opacity}>
                          <circle r={r} fill={c.fill} stroke={c.stroke} strokeWidth="2.5" />
                          <circle r={r * 0.6} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                          <circle r="3" fill="#fff" />
                        </g>
                      );
                    }

                    if (node.group === 'platform_hub') {
                      // Diamond shape with platform letter inside
                      const s = r * 1.2;
                      const letter = node.platform === 'X' ? 'X' : node.platform === 'YouTube' ? 'YT' : node.platform === 'TikTok' ? 'TK' : '?';
                      return (
                        <g opacity={opacity}>
                          <polygon
                            points={`0,${-s} ${s},0 0,${s} ${-s},0`}
                            fill={c.fill} stroke={c.stroke} strokeWidth="2.5"
                            className="transition-all duration-300"
                            filter={isSelected ? "url(#glow)" : undefined}
                          />
                          <text
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill="#fff"
                            fontSize={r * 0.5}
                            fontWeight="bold"
                            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)', pointerEvents: 'none' }}
                          >
                            {letter}
                          </text>
                        </g>
                      );
                    }

                    if (node.group === 'hashtag') {
                      // Rounded square for hashtags
                      const s = r * 1.1;
                      return (
                        <g opacity={opacity}>
                          <rect
                            x={-s} y={-s} width={s * 2} height={s * 2} rx={s * 0.35}
                            fill={c.fill} stroke={c.stroke} strokeWidth="2.5"
                            className="transition-all duration-300"
                            filter={isSelected ? "url(#glow)" : undefined}
                          />
                          <text
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill="#fff"
                            fontSize={r * 0.55}
                            fontWeight="bold"
                            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)', pointerEvents: 'none' }}
                          >
                            #
                          </text>
                        </g>
                      );
                    }

                    if (node.group === 'buzzer_master') {
                      // Triangle for buzzer masters
                      const s = r * 1.3;
                      return (
                        <g opacity={opacity}>
                          <polygon
                            points={`0,${-s} ${-s * 0.866},${s * 0.5} ${s * 0.866},${s * 0.5}`}
                            fill={c.fill} stroke={c.stroke} strokeWidth="2.5"
                            className="transition-all duration-300"
                            filter={isSelected ? "url(#glow)" : undefined}
                          />
                          <text
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill="#fff"
                            fontSize={r * 0.5}
                            fontWeight="bold"
                            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)', pointerEvents: 'none' }}
                          >
                            !
                          </text>
                        </g>
                      );
                    }

                    if (node.group === 'buzzer') {
                      // Circle with dashed stroke for buzzers
                      return (
                        <g opacity={opacity}>
                          <circle r={r} fill={c.fill} stroke={c.stroke} strokeWidth="2" strokeDasharray="3 2" />
                          {node.botScore && node.botScore > 80 && (
                            <circle r={r + 3} fill="none" stroke="#ff4444" strokeWidth="1" opacity="0.6" />
                          )}
                        </g>
                      );
                    }

                    // Fallback
                    return (
                      <circle r={r} fill={c.fill} stroke={c.stroke} strokeWidth="2" opacity={opacity} className="transition-all duration-300" />
                    );
                  })()}

                  {/* Simple text labels for important nodes */}
                  {(node.size >= 12 || isSelected || isHovered || node.group === 'platform_hub') && (
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
          <div className="absolute bottom-3 left-3 flex flex-col gap-0.5 text-[10px] bg-slate-950/95 backdrop-blur px-3 py-2 rounded-lg border border-slate-800/80 text-slate-400 font-mono max-h-[320px] overflow-y-auto">
            {legendItems.map((item: any) => {
              if (item.isHeader) return <span key={item.key} className="text-[8px] uppercase tracking-widest text-slate-600 mt-1 first:mt-0">{item.key}</span>;
              return (
                <div key={item.key} className="flex items-center gap-2">
                  <GroupMiniShape group={item.group} fill={item.fill} stroke={item.stroke} platform={item.platform} />
                  <div>
                    <span className="text-slate-300 font-semibold">{item.key}</span>
                    <span className="text-slate-600 ml-1.5">{item.desc}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="absolute bottom-3 right-3 text-[9px] text-slate-600 font-mono">
            {Math.round(zoom * 100)}%
          </div>
        </div>
      </div>

      {/* Node Details Inspection Panel */}
      <div className="flex flex-col bg-slate-950/60 rounded-xl border border-slate-800/80 p-5 shadow-inner">
        {selectedNode ? (() => {
          const detailStyle = getGroupStyle(selectedNode.group, selectedNode.botScore, selectedNode.platform);
          return (
          <div className="h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span
                  className="text-[10px] uppercase tracking-wider font-semibold font-mono px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: `${detailStyle.fill}22`,
                    color: detailStyle.fill,
                  }}
                >
                  {selectedNode.group.replace('_', ' ')}
                </span>
                {selectedNode.platform && (
                  <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded-full">
                    {selectedNode.platform}
                  </span>
                )}
              </div>

              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-slate-900 rounded-xl border border-slate-800">
                  <MiniNodeShape group={selectedNode.group} fill={detailStyle.fill} stroke={detailStyle.stroke} size={32} platform={selectedNode.platform} />
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

              {/* Buzzer Probability Meter if applicable */}
              {selectedNode.botScore !== undefined && (
                <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800/60 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400 font-medium">Probabilitas Buzzer</span>
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
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        background: selectedNode.botScore && selectedNode.botScore > 80
                          ? `linear-gradient(90deg, ${groupColors.buzzer_high.fill}, ${groupColors.buzzer_high.stroke})`
                          : selectedNode.botScore && selectedNode.botScore > 50
                          ? `linear-gradient(90deg, ${groupColors.buzzer_med.fill}, ${groupColors.buzzer_med.stroke})`
                          : `linear-gradient(90deg, ${groupColors.buzzer_low.fill}, ${groupColors.buzzer_low.stroke})`,
                        width: `${selectedNode.botScore}%`,
                      }}
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
          );
        })() : (
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
