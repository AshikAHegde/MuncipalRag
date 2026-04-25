import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import { Maximize2, Minimize2, ZoomIn, ZoomOut, RefreshCw, X, FileText, Info, CheckCircle2 } from 'lucide-react';

cytoscape.use(fcose);

const DOMAIN_COLORS = {
  criminal: '#f43f5e', // rose-500
  civil: '#f59e0b',    // amber-500
  corporate: '#0ea5e9', // sky-500
  tax: '#10b981',      // emerald-500
  general: '#64748b',   // slate-500
};

const LegalKnowledgeGraph = ({ graphData, onClose, title = "Legal Knowledge Graph" }) => {
  const containerRef = useRef(null);
  const cyRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !graphData) return;

    const elements = [];
    
    // Format nodes
    graphData.nodes.forEach(node => {
      let color = '#94a3b8';
      let shape = 'ellipse';
      
      if (node.type === 'card') {
        color = '#3b82f6';
        shape = 'round-rectangle';
      } else if (node.type === 'section') {
        if (node.data?.isCitation) {
           color = '#475569'; // Slate-600 for citations
           shape = 'round-tag';
        } else {
           color = DOMAIN_COLORS[node.data?.domain] || DOMAIN_COLORS.general;
           shape = 'diamond';
        }
      } else if (node.type === 'session') {
        color = '#8b5cf6';
        shape = 'hexagon';
      } else if (node.type === 'solution') {
        color = '#22c55e';
        shape = 'round-rectangle';
      }

      elements.push({
        data: { 
          id: node.id, 
          label: node.label,
          type: node.type,
          ...node.data
        },
        style: {
          'background-color': color,
          'shape': shape,
        }
      });
    });

    // Format edges
    graphData.edges.forEach(edge => {
      elements.push({
        data: { 
          id: edge.id, 
          source: edge.source, 
          target: edge.target, 
          label: edge.label,
          ...edge.data
        }
      });
    });

    const cy = cytoscape({
      container: containerRef.current,
      elements: elements,
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'color': '#fff',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '10px',
            'width': '60px',
            'height': '60px',
            'text-wrap': 'wrap',
            'text-max-width': '50px',
            'border-width': 2,
            'border-color': '#ffffff33',
            'overlay-padding': '6px',
            'z-index': 10
          }
        },
        {
          selector: 'node[type="card"]',
          style: {
             'width': '80px',
             'height': '40px',
          }
        },
        {
          selector: 'node[type="solution"]',
          style: {
             'width': '90px',
             'height': '44px',
             'text-max-width': '78px',
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#475569',
            'target-arrow-color': '#475569',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'label': 'data(label)',
            'font-size': '8px',
            'color': '#94a3b8',
            'text-rotation': 'autorotate',
            'text-margin-y': -10,
            'opacity': 0.6
          }
        },
        {
          selector: 'edge[type]',
          style: {
            'line-color': '#10b981',
            'target-arrow-color': '#10b981',
            'width': 3,
            'opacity': 0.9,
            'label': 'data(type)'
          }
        },
        {
          selector: 'edge[type="MATCH"]',
          style: {
            'line-color': '#38bdf8',
            'target-arrow-color': '#38bdf8',
            'width': 3,
            'opacity': 0.9,
            'label': 'MATCH'
          }
        },
        {
          selector: 'edge[type="RESPONSE"]',
          style: {
            'line-color': '#22c55e',
            'target-arrow-color': '#22c55e',
            'width': 3,
            'opacity': 0.9,
            'label': 'RESPONSE'
          }
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#fff',
            'shadow-blur': 10,
            'shadow-color': '#000',
            'shadow-opacity': 0.5
          }
        }
      ],
      layout: {
        name: 'fcose',
        quality: 'proof',
        randomize: true,
        animate: true,
        fit: true,
        padding: 50
      }
    });

    cy.on('tap', 'node', (evt) => {
      setSelectedNode(evt.target.data());
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedNode(null);
      }
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
    };
  }, [graphData]);

  const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.2);
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  const handleFit = () => cyRef.current?.fit();
  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

  return (
    <div className={`flex flex-col overflow-hidden bg-[#0f172a] text-slate-200 transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-100' : 'relative h-full w-full border-slate-700 shadow-2xl'}`}>
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-700 bg-slate-900/50 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
            <RefreshCw size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-white">{title}</h3>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">{graphData?.nodes?.length || 0} Nodes · {graphData?.edges?.length || 0} Edges</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-slate-800/50 p-1">
            <button onClick={handleZoomIn} className="p-1.5 hover:bg-slate-700 rounded-md transition" title="Zoom In"><ZoomIn size={16} /></button>
            <button onClick={handleZoomOut} className="p-1.5 hover:bg-slate-700 rounded-md transition" title="Zoom Out"><ZoomOut size={16} /></button>
            <button onClick={handleFit} className="p-1.5 hover:bg-slate-700 rounded-md transition" title="Fit to screen"><Maximize2 size={16} /></button>
          </div>
          <button onClick={toggleFullscreen} className="p-2 hover:bg-slate-800 rounded-lg transition text-slate-400 hover:text-white border border-slate-700">
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-rose-500/20 hover:text-rose-400 rounded-lg transition text-slate-400 border border-slate-700">
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="relative flex-1">
        {/* Cytoscape Container */}
        <div ref={containerRef} className="h-full w-full" />

        {/* Legend */}
        <div className="absolute bottom-4 left-4 flex flex-col gap-2 rounded-xl border border-slate-700 bg-slate-900/80 p-3 backdrop-blur-md shadow-lg pointer-events-none">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Legend</p>
          <div className="flex items-center gap-2 text-xs">
            <span className="h-3 w-3 rounded-md bg-blue-500" />
            <span>AI Answer Card</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="h-3 w-3 rotate-45 border border-slate-400" style={{ backgroundColor: DOMAIN_COLORS.criminal }} />
            <span>Criminal Section</span>
          </div>
           <div className="flex items-center gap-2 text-xs">
            <span className="h-3 w-3 rotate-45 border border-slate-400" style={{ backgroundColor: DOMAIN_COLORS.civil }} />
            <span>Civil Section</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="h-3 w-3 rounded-full bg-slate-500" />
            <span>Raw Citation</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="h-3 w-3 rounded-md bg-emerald-500" />
            <span>Response / Solution</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="h-3 w-3 rounded-full bg-purple-500" />
            <span>Chat Session</span>
          </div>
        </div>

        {/* Selected Node Details */}
        {selectedNode && (
          <div className="absolute right-4 top-4 w-72 rounded-xl border border-slate-700 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-right-4 duration-200">
             <div className="flex items-start justify-between mb-3">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  selectedNode.type === 'card' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                  selectedNode.type === 'section' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                  'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                }`}>
                  {selectedNode.type}
                </span>
                <button onClick={() => setSelectedNode(null)} className="text-slate-500 hover:text-white transition"><X size={14}/></button>
             </div>

             <h4 className="text-sm font-bold text-white mb-2 leading-snug">
               {selectedNode.label}
             </h4>

             <div className="max-h-60 overflow-y-auto space-y-2 text-xs text-slate-300 scrollbar-thin scrollbar-thumb-slate-700">
               {selectedNode.type === 'section' && (
                 <>
                   {selectedNode.sectionName && (
                     <div className="mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{selectedNode.sectionName}</div>
                   )}
                   {selectedNode.meaning && (
                     <div className="mb-2">
                       <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">What this means</p>
                       <div className="p-2 rounded bg-blue-500/5 border border-blue-500/10 text-[11px]">
                         {selectedNode.meaning}
                       </div>
                     </div>
                   )}
                   {selectedNode.reason && (
                     <div className="mb-2">
                       <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">Why Flagged</p>
                       <div className="p-2 rounded bg-amber-500/5 border border-amber-500/10 text-[11px]">
                         {selectedNode.reason}
                       </div>
                     </div>
                   )}
                   {selectedNode.consequence && (
                     <div className="mb-2">
                       <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-1">Consequence</p>
                       <div className="p-2 rounded bg-rose-500/5 border border-rose-500/10 text-[11px] font-bold">
                         {selectedNode.consequence}
                       </div>
                     </div>
                   )}
                   {selectedNode.solution && (
                     <div className="mb-2">
                       <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest mb-1">Response / Solution</p>
                       <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-medium text-emerald-50">
                         {selectedNode.solution}
                       </div>
                     </div>
                   )}
                   {selectedNode.source && (
                     <div className="flex items-center gap-2 text-slate-400 mt-2">
                       <FileText size={12}/>
                       <span>Source: {selectedNode.source}</span>
                     </div>
                   )}
                   {selectedNode.text && (
                     <div className="p-2 rounded bg-white/5 italic text-[11px] mt-2">
                       "{selectedNode.text.substring(0, 150)}..."
                     </div>
                   )}
                 </>
               )}
               {selectedNode.type === 'card' && (
                 <>
                   <div className="flex items-center gap-2 text-blue-400">
                     <Info size={12}/>
                     <span>Mode: {selectedNode.mode}</span>
                   </div>
                   <div className="p-2 rounded bg-blue-500/5">
                     {selectedNode.answer?.substring(0, 200)}...
                   </div>
                 </>
               )}
               {selectedNode.type === 'solution' && (
                 <>
                   <div className="flex items-center gap-2 text-emerald-300">
                     <CheckCircle2 size={12}/>
                     <span>Attached to: {selectedNode.section || 'Conflict'}</span>
                   </div>
                   <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-50">
                     {selectedNode.solution}
                   </div>
                 </>
               )}
             </div>

             {selectedNode.type === 'section' && (
               <button className="mt-4 w-full rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-white hover:bg-blue-500 transition shadow-[0_0_15px_rgba(37,99,235,0.3)]">
                 Read Full Provisions
               </button>
             )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LegalKnowledgeGraph;
