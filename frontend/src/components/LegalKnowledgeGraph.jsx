import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import SpriteText from 'three-spritetext';
import * as THREE from 'three';
import { Maximize2, Minimize2, ZoomIn, ZoomOut, RefreshCw, X, FileText, Info } from 'lucide-react';

const DOMAIN_COLORS = {
  criminal: '#f43f5e', // rose-500
  civil: '#f59e0b',    // amber-500
  corporate: '#0ea5e9', // sky-500
  tax: '#10b981',      // emerald-500
  general: '#64748b',   // slate-500
};

const LegalKnowledgeGraph = ({ graphData, onClose, title = "Legal Knowledge Graph" }) => {
  const containerRef = useRef(null);
  const fgRef = useRef();

  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isRotating, setIsRotating] = useState(true);

  // Parse Graph Data
  const { nodes, edges } = useMemo(() => {
    if (!graphData) return { nodes: [], edges: [] };

    const rawNodes = Array.isArray(graphData.nodes) ? graphData.nodes : [];
    const rawEdges = Array.isArray(graphData.edges) ? graphData.edges : [];
    const solutionNodeIds = new Set(rawNodes.filter((node) => node.type === 'solution').map((node) => node.id));

    const edgesWithoutSolutions = rawEdges.filter((edge) => (
      !solutionNodeIds.has(edge.source)
      && !solutionNodeIds.has(edge.target)
      && edge.label !== 'RESPONSE'
      && edge.data?.type !== 'RESPONSE'
    ));

    const hasConflictNodes = rawNodes.some((node) => String(node.id || '').startsWith('conflict-'));
    const matchedCitationIds = new Set();
    edgesWithoutSolutions.forEach((edge) => {
      if (edge.label === 'MATCH' || edge.data?.type === 'MATCH') {
        matchedCitationIds.add(edge.source);
        matchedCitationIds.add(edge.target);
      }
    });

    const filterNodes = rawNodes.filter((node) => (
      !solutionNodeIds.has(node.id)
      && (!hasConflictNodes || !node.data?.isCitation || matchedCitationIds.has(node.id))
    ));

    // Map edges properly and ensure unique objects
    const nodeIds = new Set(filterNodes.map((node) => node.id));
    const processedNodes = filterNodes.map(n => ({ ...n }));
    const processedEdges = edgesWithoutSolutions
      .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      .map(e => ({ ...e }));

    return { nodes: processedNodes, edges: processedEdges };
  }, [graphData]);

  // Handle Resize
  useEffect(() => {
    if (!containerRef.current) return;
    const updateDimensions = () => {
      setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight
      });
    };

    // Slight delay to ensure flex container has layouted
    const timeoutId = setTimeout(updateDimensions, 100);
    window.addEventListener('resize', updateDimensions);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateDimensions);
    }
  }, []);

  // Camera Auto Rotation
  useEffect(() => {
    if (!fgRef.current) return;

    let animationFrameId;

    const rotate = () => {
      if (isRotating && !hoveredNode && !selectedNode) {
        const currentPos = fgRef.current.cameraPosition();
        // Get true current angle to avoid snapping
        let currentAngle = Math.atan2(currentPos.x, currentPos.z);
        currentAngle += Math.PI / 1000;

        // maintain the exact current radius and Y height
        const r = Math.hypot(currentPos.x, currentPos.z);

        fgRef.current.cameraPosition({
          x: r * Math.sin(currentAngle),
          y: currentPos.y,
          z: r * Math.cos(currentAngle)
        });
      }
      animationFrameId = requestAnimationFrame(rotate);
    };

    rotate();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isRotating, hoveredNode, selectedNode]);

  // Interaction handlers
  const handleNodeClick = useCallback(node => {
    setSelectedNode(node);
    setIsRotating(false);

    if (fgRef.current) {
      // Aim at node and zoom in without flying to infinity if at origin
      const currentPos = fgRef.current.cameraPosition();
      const dist = Math.hypot(
        currentPos.x - node.x,
        currentPos.y - node.y,
        currentPos.z - node.z
      );
      const targetDist = 120; // Fixed distance from node
      const ratio = targetDist / Math.max(dist, 1);

      fgRef.current.cameraPosition(
        {
          x: node.x + (currentPos.x - node.x) * ratio,
          y: node.y + (currentPos.y - node.y) * ratio,
          z: node.z + (currentPos.z - node.z) * ratio
        },
        node,
        1200  // ms transition duration
      );
    }
  }, []);

  const handleZoom = (factor) => {
    if (fgRef.current) {
      setIsRotating(false); // Disable rotation during manual zoom
      const currentPos = fgRef.current.cameraPosition();
      const controls = fgRef.current.controls();
      const target = controls.target;

      fgRef.current.cameraPosition(
        {
          x: target.x + (currentPos.x - target.x) * factor,
          y: target.y + (currentPos.y - target.y) * factor,
          z: target.z + (currentPos.z - target.z) * factor
        },
        target,
        500
      );
    }
  };

  const handleZoomIn = () => handleZoom(0.6);
  const handleZoomOut = () => handleZoom(1.5);
  const handleFit = () => {
    fgRef.current?.zoomToFit(1000);
    setIsRotating(true);
    setSelectedNode(null);
  };

  return (
    <div className={`flex flex-col overflow-hidden bg-transparent text-slate-200 relative h-full w-full`}>

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex shrink-0 items-center justify-between border-b border-white/5 bg-black/40 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.3)]">
            <RefreshCw size={18} className={isRotating ? "animate-spin-slow text-sky-300" : ""} />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-white drop-shadow-md">{title}</h3>
            <p className="text-[10px] text-sky-400/80 uppercase tracking-widest">{nodes.length} Nodes · {edges.length} Edges</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-white/5 p-1 backdrop-blur-sm border border-white/10">
            <button onClick={handleZoomIn} className="p-1.5 hover:bg-white/10 rounded-md transition text-slate-300" title="Zoom In"><ZoomIn size={16} /></button>
            <button onClick={handleZoomOut} className="p-1.5 hover:bg-white/10 rounded-md transition text-slate-300" title="Zoom Out"><ZoomOut size={16} /></button>
            <button onClick={handleFit} className="p-1.5 hover:bg-white/10 rounded-md transition text-slate-300" title="Reset View"><Maximize2 size={16} /></button>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-rose-500/20 hover:text-rose-400 rounded-lg transition text-slate-300 border border-white/10 bg-white/5 backdrop-blur-sm">
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      <div ref={containerRef} className="relative flex-1 w-full bg-transparent h-full">
        {dimensions.width > 0 && dimensions.height > 0 && (
          <ForceGraph3D
            ref={fgRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={{ nodes, links: edges }}
            backgroundColor="rgba(0,0,0,0)"
            showNavInfo={false}
            rendererConfig={{ antialias: true, alpha: true }}

            nodeLabel={null} // completely custom
            onNodeHover={node => setHoveredNode(node)}
            onNodeClick={handleNodeClick}

            // Edges setup
            linkDirectionalParticles={d => d.label === 'MATCH' || d.type === 'MATCH' || d.data?.type === 'MATCH' ? 4 : 2}
            linkDirectionalParticleSpeed={d => d.label === 'MATCH' || d.type === 'MATCH' || d.data?.type === 'MATCH' ? 0.015 : 0.005}
            linkDirectionalParticleWidth={d => d.label === 'MATCH' || d.type === 'MATCH' || d.data?.type === 'MATCH' ? 3 : 1.5}
            linkDirectionalParticleColor={link => link.label === 'MATCH' || link.type === 'MATCH' || link.data?.type === 'MATCH' ? '#38bdf8' : '#7dd3fc'}
            linkOpacity={0.4}
            linkColor={link => link.label === 'MATCH' || link.type === 'MATCH' || link.data?.type === 'MATCH' ? 'rgba(56,189,248,0.6)' : 'rgba(51,65,85,0.4)'}
            linkWidth={link => link.label === 'MATCH' || link.type === 'MATCH' || link.data?.type === 'MATCH' ? 1.5 : 0.5}
            linkCurvature={0.15}
            linkCurveRotation={0}

            // Custom Nodes using ThreeJS
            nodeThreeObject={node => {
              const group = new THREE.Group();

              // Colors
              const color = node.type === 'card' ? '#38bdf8' : // sky
                            node.type === 'session' ? '#a855f7' : // purple
                            node.type === 'section' ? (node.data?.isCitation ? '#94a3b8' : (DOMAIN_COLORS[node.data?.domain] || DOMAIN_COLORS.general)) :
                            '#475569';
                            
              const baseScale = 5; // User requested all circles to be same size
              
              // 1. Inner Shiny Core
              const geometry = new THREE.SphereGeometry(baseScale, 24, 24);
              const material = new THREE.MeshPhongMaterial({ 
                color: color,
                transparent: true,
                opacity: 0.95,
                shininess: 100, // Beautiful glossy specular highlight
                specular: new THREE.Color('#ffffff'),
              });
              const sphere = new THREE.Mesh(geometry, material);
              group.add(sphere);

              // 2. Outer Holographic Glowing Aura
              const auraGeometry = new THREE.SphereGeometry(baseScale * 1.6, 24, 24);
              const auraMaterial = new THREE.MeshBasicMaterial({
                 color: color,
                 transparent: true,
                 opacity: 0.15,
                 blending: THREE.AdditiveBlending, // Native Bloom/Glow trick
                 depthWrite: false
              });
              const aura = new THREE.Mesh(auraGeometry, auraMaterial);
              group.add(aura);

              // Sprite Text Label
              const sprite = new SpriteText(node.label || 'Node');
              sprite.color = '#ffffff';
              sprite.textHeight = 4;
              sprite.position.y = 12; // Float above node
              sprite.backgroundColor = 'rgba(0,0,0,0.8)';
              sprite.padding = [4, 2];
              sprite.borderRadius = 8;
              sprite.fontFace = 'Inter, sans-serif';
              sprite.fontSize = 80; // Safe resolution to avoid WebGL max texture width smearing
              sprite.fontWeight = '500';
              sprite.material.depthWrite = true; // removed false to allow proper sorting
              group.add(sprite);

              return group;
            }}
          />
        )}

        {/* Legend Overlay */}
        <div className="absolute bottom-6 left-6 flex flex-col gap-2 rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur-xl shadow-2xl pointer-events-none">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Graph Legend</p>
          <div className="flex items-center gap-2 text-xs">
            <span className="h-3 w-3 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.8)]" />
            <span className="text-slate-200">AI Answer Card</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="h-3 w-3 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]" />
            <span className="text-slate-200">Criminal Section</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="h-3 w-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
            <span className="text-slate-200">Civil Section</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="h-3 w-3 rounded-full bg-slate-500 shadow-[0_0_10px_rgba(100,116,139,0.8)]" />
            <span className="text-slate-200">Raw Citation</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="h-3 w-3 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
            <span className="text-slate-200">Chat Session</span>
          </div>
        </div>

        {/* Selected Node Drawer */}
        {selectedNode && (
          <div className="absolute right-6 top-20 w-80 md:w-96 rounded-2xl border border-white/10 bg-black/60 p-6 shadow-[0_0_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl animate-in slide-in-from-right-8 duration-300 z-20">
            <div className="flex items-start justify-between mb-4">
              <span className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${selectedNode.type === 'card' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' :
                  selectedNode.type === 'section' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                    'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                }`}>
                {selectedNode.type}
              </span>
              <button onClick={() => { setSelectedNode(null); setIsRotating(true); }} className="text-slate-400 hover:text-white transition"><X size={20} /></button>
            </div>

            <h4 className="text-xl font-bold text-white mb-4 leading-snug drop-shadow-md">
              {selectedNode.label}
            </h4>

            <div className="max-h-96 overflow-y-auto space-y-4 text-sm text-slate-300 pr-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {selectedNode.type !== 'card' && selectedNode.type !== 'session' && (
                <>
                  {selectedNode.sectionName && (
                    <div className="mb-3 text-xs font-bold text-slate-400 uppercase tracking-widest">{selectedNode.sectionName}</div>
                  )}
                  {selectedNode.data?.text && (
                    <div className="mb-3">
                       <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 opacity-80">Reference Text</p>
                       <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-sm leading-relaxed">
                         {selectedNode.data.text}
                       </div>
                    </div>
                  )}
                  {selectedNode.data?.meaning && (
                    <div className="mb-3">
                      <p className="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 opacity-80">What this means</p>
                      <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-sm leading-relaxed">
                        {selectedNode.data.meaning}
                      </div>
                    </div>
                  )}
                  {selectedNode.data?.reason && (
                    <div className="mb-3">
                      <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2 opacity-80">Why Flagged</p>
                      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/10 text-sm leading-relaxed border-l-2 border-l-amber-500">
                        {selectedNode.data.reason}
                      </div>
                    </div>
                  )}
                  {selectedNode.data?.consequence && (
                    <div className="mb-3">
                      <p className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-2 opacity-80">Consequence</p>
                      <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-sm font-bold leading-relaxed text-rose-200 border-l-2 border-l-rose-500">
                        {selectedNode.data.consequence}
                      </div>
                    </div>
                  )}
                  {selectedNode.data?.solution && (
                    <div className="mb-3">
                      <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2 opacity-80">Proposed Solution</p>
                      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm font-bold leading-relaxed text-emerald-200 border-l-2 border-l-emerald-500">
                        {selectedNode.data.solution}
                      </div>
                    </div>
                  )}
                </>
              )}
              {selectedNode.type === 'card' && (
                <>
                  <div className="flex items-center gap-2 text-sky-400 text-sm font-semibold">
                    <Info size={16} />
                    <span>Mode: {selectedNode.mode}</span>
                  </div>
                  <div className="p-4 text-sm rounded-xl bg-white/5 border border-white/5 leading-relaxed">
                    {selectedNode.answer?.substring(0, 250)}...
                  </div>
                </>
              )}
            </div>

            {selectedNode.type !== 'card' && selectedNode.type !== 'session' && (
              <button className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 px-4 py-3 text-[13px] font-bold uppercase tracking-widest text-white transition shadow-[0_0_20px_rgba(14,165,233,0.4)]">
                <FileText size={16} /> Read Full Provisions
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LegalKnowledgeGraph;
