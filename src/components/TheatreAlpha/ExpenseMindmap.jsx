// ---------------------------------------------------------------------------
// ExpenseMindmap — interactive node-based expense visualization.
//
// Uses reactflow to render a draggable, editable graph of expenses.
// - Supports right-click context menus on nodes to edit topic/cost or delete.
// - Supports right-click on empty canvas to add a new blank expense.
// - Clicking on a line (edge) disconnects it.
// - Nodes and edges are fully decoupled; changes sync back to parent `expenses` array.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Plus, Trash2, X, Coins, FolderOpen, CircleDot, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatMoney } from '../../lib/finance';

// ---------------------------------------------------------------------------
// Custom node types
// ---------------------------------------------------------------------------

function RootNode({ id, data, selected }) {
  const { setNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);

  const handleChange = (e) => {
    const val = e.target.value;
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, label: val } } : n));
    if (data.onChange) data.onChange(val);
  };

  return (
    <div className={`px-5 py-3 rounded-xl border-2 bg-gradient-to-br from-[#2a2b30] to-[#1f2025] shadow-xl shadow-black/30 min-w-[180px] transition-all duration-200 ${selected ? 'border-amber-400 ring-4 ring-amber-400/20' : 'border-white/20'}`}>
      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-white/40 !border-white/20" />
      <div className="flex items-center gap-2 mb-1">
        <Coins className="w-4 h-4 text-amber-400" />
        <p className="text-[10px] tracking-widest uppercase text-white/40">Total Budget</p>
      </div>
      {isEditing ? (
        <input
          autoFocus
          value={data.label}
          onChange={handleChange}
          onBlur={() => setIsEditing(false)}
          onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
          onFocus={data.onFocus}
          placeholder="Project Topic"
          className="w-full bg-transparent text-lg font-display font-semibold text-white leading-none focus:outline-none placeholder:text-white/20"
        />
      ) : (
        <h2 onDoubleClick={() => setIsEditing(true)} className="text-lg font-display font-semibold text-white leading-none cursor-text truncate min-h-[1.2em]">
          {data.label || 'Project Topic'}
        </h2>
      )}
      <p className="text-xs text-amber-300 font-mono mt-1">{data.amount}</p>
    </div>
  );
}

function CategoryNode({ id, data, selected }) {
  const { setNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  
  const handleLabelChange = (e) => {
    const val = e.target.value;
    setNodes(nds => {
      const next = nds.map(n => n.id === id ? { ...n, data: { ...n.data, label: val } } : n);
      if (data.onChange) data.onChange(next);
      return next;
    });
  };

  return (
    <div className={`px-4 py-2.5 rounded-lg border bg-[#232429] shadow-lg shadow-black/20 min-w-[140px] transition-all duration-200 ${selected ? 'border-blue-400 ring-4 ring-blue-400/20' : 'border-white/15'}`}>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-white/30 !border-white/15" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-white/30 !border-white/15" />
      <div className="flex items-center gap-1.5 mb-1">
        <FolderOpen className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        {isEditing ? (
          <input
            autoFocus
            value={data.label}
            onChange={handleLabelChange}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
            onFocus={data.onFocus}
            placeholder="Category"
            className="w-full bg-transparent text-xs font-medium text-white focus:outline-none focus:border-b focus:border-blue-400/50"
          />
        ) : (
          <p onDoubleClick={() => setIsEditing(true)} className="w-full text-xs font-medium text-white cursor-text truncate min-h-[1.2em]">
            {data.label || 'Category'}
          </p>
        )}
      </div>
      <p className="text-[10px] text-blue-300 font-mono">{data.amount}</p>
    </div>
  );
}

function ExpenseNode({ id, data, selected }) {
  const { setNodes } = useReactFlow();
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const paid = data.paid || false;

  // Color scheme: red = unpaid, green = paid
  const accent = paid ? 'emerald' : 'red';
  const borderSel = paid ? 'border-emerald-400 ring-4 ring-emerald-400/20' : 'border-red-400 ring-4 ring-red-400/20';
  const dotColor = paid ? 'text-emerald-400' : 'text-red-400';
  const amountColor = paid ? 'text-emerald-300' : 'text-red-300';
  const amountDim = paid ? 'text-emerald-300/50' : 'text-red-300/50';
  const focusBorder = paid ? 'focus:border-emerald-400/50' : 'focus:border-red-400/50';

  const handleLabelChange = (e) => {
    const val = e.target.value;
    setNodes(nds => {
      const next = nds.map(n => n.id === id ? { ...n, data: { ...n.data, label: val } } : n);
      if (data.onChange) data.onChange(next);
      return next;
    });
  };

  const handleAmountChange = (e) => {
    const val = e.target.value;
    setNodes(nds => {
      const next = nds.map(n => n.id === id ? { ...n, data: { ...n.data, rawAmount: val, amount: formatMoney(Number(val) || 0, data.sym || '฿') } } : n);
      if (data.onChange) data.onChange(next);
      return next;
    });
  };

  return (
    <div className={`group px-3 py-2 rounded-md border bg-[#1c1d22] hover:bg-[#25262c] shadow-md shadow-black/15 min-w-[140px] transition-all duration-200 ${selected ? borderSel : 'border-white/10'}`}>
      <Handle type="target" position={Position.Top} className="!w-1.5 !h-1.5 !bg-white/20 !border-white/10" />
      <div className="flex items-center gap-1.5 mb-1" onDoubleClick={() => setIsEditingLabel(true)}>
        {paid ? <CheckCircle className={`w-2.5 h-2.5 ${dotColor} shrink-0`} /> : <CircleDot className={`w-2 h-2 ${dotColor} shrink-0`} />}
        {isEditingLabel ? (
          <input
            autoFocus
            value={data.label}
            onChange={handleLabelChange}
            onBlur={() => setIsEditingLabel(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditingLabel(false)}
            onFocus={data.onFocus}
            placeholder="Expense Topic"
            className={`w-full bg-transparent text-[11px] text-white/90 focus:outline-none focus:border-b ${focusBorder}`}
          />
        ) : (
          <p className={`w-full text-[11px] cursor-text truncate min-h-[1.2em] ${paid ? 'text-white/90' : 'text-white/90'}`}>
            {data.label || 'Expense Topic'}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 pl-3.5" onDoubleClick={() => setIsEditingAmount(true)}>
        <span className={`text-[10px] ${amountDim}`}>{data.sym || '฿'}</span>
        {isEditingAmount ? (
          <input
            autoFocus
            type="number"
            value={data.rawAmount}
            onChange={handleAmountChange}
            onBlur={() => setIsEditingAmount(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditingAmount(false)}
            onFocus={data.onFocus}
            placeholder="0"
            className={`w-full bg-transparent text-[11px] ${amountColor} font-mono focus:outline-none focus:border-b ${focusBorder}`}
          />
        ) : (
          <p className={`w-full text-[11px] ${amountColor} font-mono cursor-text min-h-[1.2em] ${paid ? 'line-through opacity-60' : ''}`}>
            {data.rawAmount || 0}
          </p>
        )}
      </div>
      {paid && <p className="text-[9px] text-emerald-400/60 mt-1 text-right font-mono">PAID ✓</p>}
    </div>
  );
}

const nodeTypes = {
  root: RootNode,
  category: CategoryNode,
  expense: ExpenseNode,
};

// ---------------------------------------------------------------------------
// Auto-Categorization Helpers
// ---------------------------------------------------------------------------

const CATEGORY_MAP = {
  'Crew':       ['Crew', 'Gaffer', 'Grip', 'Pilot', 'G&E', 'crew', 'gaffer'],
  'Equipment':  ['Camera', 'Equipment', 'Drone', 'Transport', 'Rental', 'camera', 'equipment', 'drone'],
  'Location':   ['Location', 'Permit', 'Travel', 'location', 'permit', 'travel'],
  'Production': ['Catering', 'catering', 'Food', 'Wardrobe', 'Props', 'Art'],
};

function categorizeExpense(name) {
  if (!name) return 'Production';
  for (const [cat, keywords] of Object.entries(CATEGORY_MAP)) {
    if (keywords.some(k => name.toLowerCase().includes(k.toLowerCase()))) return cat;
  }
  return 'Production'; // default fallback
}

// ---------------------------------------------------------------------------
// Inner Component (Wrapped in ReactFlowProvider)
// ---------------------------------------------------------------------------

function ExpenseMindmapInner({ expenses, projectName, sym, onExpensesChange, onProjectNameChange }) {
  const containerRef = useRef(null);
  const { screenToFlowPosition, fitView } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const initialized = useRef(false);

  // Context Menu State
  const [paneMenu, setPaneMenu] = useState(null);
  const [nodeMenu, setNodeMenu] = useState(null); // { nodeId, x, y }

  // --- Sync References ---
  const edgesRef = useRef(edges);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  // --- Undo / Redo ---
  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const isUndoRedoAction = useRef(false);

  const pushUndoState = useCallback(() => {
    if (isUndoRedoAction.current) return;
    undoStack.current.push({ nodes, edges });
    if (undoStack.current.length > 30) undoStack.current.shift();
    redoStack.current = [];
  }, [nodes, edges]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only capture if not typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          // Redo
          if (redoStack.current.length > 0) {
            const next = redoStack.current.pop();
            undoStack.current.push({ nodes, edges });
            isUndoRedoAction.current = true;
            setNodes(next.nodes);
            setEdges(next.edges);
            triggerSyncRef.current(next.nodes);
            setTimeout(() => isUndoRedoAction.current = false, 50);
          }
        } else {
          // Undo
          if (undoStack.current.length > 0) {
            const prev = undoStack.current.pop();
            redoStack.current.push({ nodes, edges });
            isUndoRedoAction.current = true;
            setNodes(prev.nodes);
            setEdges(prev.edges);
            triggerSyncRef.current(prev.nodes);
            setTimeout(() => isUndoRedoAction.current = false, 50);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes, edges, setNodes, setEdges]);

  // --- 2. Sync to Parent ---
  const syncTimer = useRef(null);
  const triggerSync = useCallback((nds) => {
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      const currentEdges = edgesRef.current;
      const expNodes = nds.filter(n => n.type === 'expense');
      const newExpenses = expNodes.map(n => {
        const edge = currentEdges.find(e => e.target === n.id);
        let catName = categorizeExpense(n.data.label);
        if (edge) {
          const catNode = nds.find(c => c.id === edge.source && c.type === 'category');
          if (catNode && catNode.data.label) catName = catNode.data.label;
        }
        return {
          id: n.id,
          description: n.data.label,
          category: catName,
          amount: Number(n.data.rawAmount) || 0,
          expense_date: n.data.date || new Date().toISOString().slice(0, 10),
          x: n.position?.x || 0,
          y: n.position?.y || 0
        };
      });
      onExpensesChange(newExpenses);
    }, 100);
  }, [onExpensesChange]);

  const triggerSyncRef = useRef(triggerSync);
  triggerSyncRef.current = triggerSync;

  // --- 1. Initial Build & Sync from External Changes ---
  useEffect(() => {
    // If not initialized, build the full graph (categories + root)
    if (!initialized.current) {
      const total = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const grouped = { Crew: [], Equipment: [], Location: [], Production: [], Other: [] };
      expenses.forEach(ex => {
        let cat = ex.category;
        if (!cat) cat = categorizeExpense(ex.description || ex.expense_name);
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(ex);
      });

      const newNodes = [];
      const newEdges = [];

      newNodes.push({
        id: 'root', type: 'root', position: { x: 300, y: 30 },
        data: { label: projectName || 'Project', amount: formatMoney(total, sym), onChange: onProjectNameChange, onFocus: pushUndoState },
      });

      const catKeys = Object.keys(grouped).filter(k => grouped[k].length > 0);

      const spacing = 220;
      const startX = 300 - ((catKeys.length - 1) * spacing) / 2;

      catKeys.forEach((cat, ci) => {
        const catId = `cat-${cat}`;
        const catExpenses = grouped[cat];
        const catTotal = catExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

        newNodes.push({
          id: catId, type: 'category', position: { x: startX + ci * spacing, y: 150 },
          data: { label: cat, amount: formatMoney(catTotal, sym), onFocus: pushUndoState, onChange: (nds) => triggerSyncRef.current(nds) },
        });

        newEdges.push({
          id: `root-${catId}`, source: 'root', target: catId,
          style: { stroke: 'rgba(255,255,255,0.12)', strokeWidth: 1.5 }, animated: true,
          interactionWidth: 20,
        });

        const expSpacing = 160;
        const expStartX = startX + ci * spacing - ((catExpenses.length - 1) * expSpacing) / 2;

        catExpenses.forEach((ex, ei) => {
          const exId = ex.id;
          newNodes.push({
            id: exId, type: 'expense', position: { x: expStartX + ei * expSpacing, y: 280 + Math.random() * 20 },
            data: { label: ex.description || ex.expense_name, amount: formatMoney(Number(ex.amount) || 0, sym), rawAmount: Number(ex.amount) || 0, date: ex.expense_date || ex.date, onFocus: pushUndoState, onChange: (nds) => triggerSyncRef.current(nds) },
          });

          newEdges.push({
            id: `${catId}-${exId}`, source: catId, target: exId,
            style: { stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 },
            interactionWidth: 20,
          });
        });
      });

      setNodes(newNodes);
      setEdges(newEdges);
      initialized.current = true;
      
      // Delay fitView slightly so ReactFlow handles initial render
      setTimeout(() => fitView({ padding: 0.3 }), 50);
      return;
    }

    // Subsequent updates (e.g. edited from Left Pane). Merge smartly.
    // To avoid infinite loops, we only update node data if it differs, or create missing nodes.
    setNodes(nds => {
      let changed = false;
      const nextNodes = nds.map(n => {
        if (n.type !== 'expense') return n;
        const matched = expenses.find(e => e.id === n.id);
        if (matched) {
          if (n.data.label !== (matched.description || matched.expense_name) || n.data.rawAmount !== Number(matched.amount)) {
            changed = true;
            return { ...n, data: { ...n.data, label: matched.description || matched.expense_name, rawAmount: Number(matched.amount), amount: formatMoney(Number(matched.amount) || 0, sym), date: matched.expense_date || matched.date, onFocus: pushUndoState, onChange: (nds) => triggerSyncRef.current(nds) } };
          }
        }
        return n;
      });

      // Handle additions
      const existingIds = new Set(nextNodes.filter(n => n.type === 'expense').map(n => n.id));
      expenses.forEach((ex, i) => {
        if (!existingIds.has(ex.id)) {
          changed = true;
          nextNodes.push({
            id: ex.id,
            type: 'expense',
            position: { x: 300 + (Math.random() * 50 - 25), y: 350 + (i * 20) }, // fallback position
            data: { label: ex.description || ex.expense_name, amount: formatMoney(Number(ex.amount) || 0, sym), rawAmount: Number(ex.amount) || 0, date: ex.expense_date || ex.date, onFocus: pushUndoState }
          });
        }
      });

      // Handle deletions
      const expenseIds = new Set(expenses.map(e => e.id));
      const filteredNodes = nextNodes.filter(n => n.type !== 'expense' || expenseIds.has(n.id));
      if (filteredNodes.length !== nextNodes.length) changed = true;

      return changed ? filteredNodes : nds;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, projectName, sym]);

  // Dynamic Totals calculation (Root and Categories) based on edges
  useEffect(() => {
    if (!initialized.current) return;
    setNodes(nds => {
      let changed = false;
      const nextNodes = nds.map(n => {
        if (n.type === 'category') {
          // Find expenses connected to this category
          const connected = edges.filter(e => e.source === n.id).map(e => e.target);
          const catTotal = nds.filter(ex => connected.includes(ex.id) && ex.type === 'expense')
                              .reduce((sum, ex) => sum + (Number(ex.data.rawAmount) || 0), 0);
          const fmt = formatMoney(catTotal, sym);
          if (n.data.amount !== fmt) {
            changed = true;
            return { ...n, data: { ...n.data, amount: fmt } };
          }
        } else if (n.type === 'root') {
          // Total of all expenses in graph
          const rootTotal = nds.filter(ex => ex.type === 'expense')
                               .reduce((sum, ex) => sum + (Number(ex.data.rawAmount) || 0), 0);
          const fmt = formatMoney(rootTotal, sym);
          if (n.data.amount !== fmt) {
            changed = true;
            return { ...n, data: { ...n.data, amount: fmt } };
          }
        }
        return n;
      });
      return changed ? nextNodes : nds;
    });
  }, [nodes, edges, sym, setNodes]);

  // --- 2. Sync to Parent ---
  // Whenever nodes change, we trigger onExpensesChange to update the left pane
  // Debounce to prevent React state cycle thrashing
  // --- 3. Edge Interactions ---
  const onConnect = useCallback(
    (params) => {
      pushUndoState();
      setEdges((eds) => {
        const nextEdges = addEdge({ ...params, style: { stroke: 'rgba(255,255,255,0.1)' } }, eds);
        edgesRef.current = nextEdges;
        setNodes(nds => { triggerSyncRef.current(nds); return nds; });
        return nextEdges;
      });
    },
    [setEdges, pushUndoState, setNodes]
  );

  const onEdgeClick = useCallback((evt, edge) => {
    evt.stopPropagation();
    pushUndoState();
    setEdges(eds => {
      const nextEdges = eds.filter(e => e.id !== edge.id);
      edgesRef.current = nextEdges;
      setNodes(nds => { triggerSyncRef.current(nds); return nds; });
      return nextEdges;
    });
  }, [setEdges, pushUndoState, setNodes]);

  const onNodesDelete = useCallback((deleted) => {
    pushUndoState();
    if (deleted.some(n => n.type === 'expense')) {
      setNodes(nds => {
        // Compute the remaining nodes to sync them immediately
        const remaining = nds.filter(n => !deleted.some(d => d.id === n.id));
        triggerSync(remaining);
        return nds; // let ReactFlow's onNodesChange actually handle the state removal
      });
    }
  }, [setNodes, pushUndoState]);

  // --- 4. Context Menus ---
  const onPaneContextMenu = useCallback((evt) => {
    evt.preventDefault();
    setNodeMenu(null);
    const rect = containerRef.current.getBoundingClientRect();
    setPaneMenu({
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top,
      pos: screenToFlowPosition({ x: evt.clientX, y: evt.clientY })
    });
  }, [screenToFlowPosition]);

  const onNodeContextMenu = useCallback((evt, node) => {
    if (node.type !== 'expense') return;
    evt.preventDefault();
    setPaneMenu(null);
    const rect = containerRef.current.getBoundingClientRect();
    setNodeMenu({
      nodeId: node.id,
      paid: node.data.paid || false,
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top,
    });
  }, []);

  const handleTogglePaid = useCallback(() => {
    if (!nodeMenu) return;
    pushUndoState();
    setNodes(nds => {
      const next = nds.map(n => n.id === nodeMenu.nodeId
        ? { ...n, data: { ...n.data, paid: !nodeMenu.paid } }
        : n
      );
      triggerSync(next);
      return next;
    });
    setNodeMenu(null);
  }, [nodeMenu, setNodes, pushUndoState]);

  const handleDeleteNode = useCallback(() => {
    if (!nodeMenu) return;
    pushUndoState();
    setNodes(nds => {
      const next = nds.filter(n => n.id !== nodeMenu.nodeId);
      setEdges(eds => eds.filter(e => e.source !== nodeMenu.nodeId && e.target !== nodeMenu.nodeId));
      triggerSync(next);
      return next;
    });
    setNodeMenu(null);
  }, [nodeMenu, setNodes, setEdges, pushUndoState]);

  const handleAddFromPane = () => {
    if (!paneMenu) return;
    pushUndoState();
    const newId = `ex-${Date.now()}`;
    const newNode = {
      id: newId,
      type: 'expense',
      position: paneMenu.pos,
      data: { label: '', amount: formatMoney(0, sym), rawAmount: 0, paid: false, date: new Date().toISOString().slice(0,10), onFocus: pushUndoState, onChange: (nds) => triggerSyncRef.current(nds) }
    };
    setNodes(nds => {
      const next = [...nds, newNode];
      triggerSync(next);
      return next;
    });
    setPaneMenu(null);
  };

  const closeMenu = () => { setPaneMenu(null); setNodeMenu(null); };

  const total = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  return (
    <>
      <style>{`
        .custom-edges .react-flow__edge:hover .react-flow__edge-path {
          stroke: #ef4444 !important;
          stroke-width: 3 !important;
          stroke-dasharray: 4,4 !important;
          transition: all 0.2s ease;
        }
        .custom-edges .react-flow__edge {
          cursor: pointer;
        }
      `}</style>
      <div className="rounded-xl border border-white/10 bg-[#0d0d10] overflow-hidden flex flex-col h-full relative" ref={containerRef}>
        {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-white/8 z-10 bg-[#0d0d10]">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <p className="text-[10px] tracking-widest2 uppercase text-white/40">Expense Mindmap</p>
          <span className="text-[10px] text-white/25 font-mono">{formatMoney(total, sym)}</span>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 min-h-0" onClick={closeMenu}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodesDelete={onNodesDelete}
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          onPaneContextMenu={onPaneContextMenu}
          onNodeContextMenu={onNodeContextMenu}
          nodeTypes={nodeTypes}
          connectionLineStyle={{ stroke: '#34d399', strokeWidth: 2, strokeDasharray: '5,5' }}
          proOptions={{ hideAttribution: true }}
          className="!bg-transparent custom-edges"
        >
          <Background color="rgba(255,255,255,0.03)" gap={24} size={1} />
          <Controls
            className="!bg-white/5 !border-white/10 !rounded-lg [&>button]:!bg-white/5 [&>button]:!border-white/8 [&>button]:!text-white/40 [&>button:hover]:!bg-white/10 [&>button:hover]:!text-white"
            showInteractive={false}
          />
          <MiniMap
            nodeColor={(n) => {
              if (n.type === 'root') return '#fbbf24';
              if (n.type === 'category') return '#60a5fa';
              if (n.data?.paid) return '#34d399';
              return '#f87171';
            }}
            className="!bg-white/[0.03] !border-white/8 !rounded-lg"
            maskColor="rgba(0,0,0,0.6)"
          />
        </ReactFlow>
      </div>

      {/* Tip */}
      <div className="shrink-0 px-4 py-1.5 border-t border-white/5 text-center bg-[#0d0d10] z-10">
        <p className="text-[9px] text-white/20">Cmd/Ctrl+Z to Undo · Right-click canvas to add node · Click/Hover line to disconnect</p>
      </div>

      {/* Floating Pane Context Menu */}
      <AnimatePresence>
        {paneMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="absolute z-50 p-1.5 rounded-lg border border-white/15 bg-ink-950/95 backdrop-blur-xl shadow-2xl shadow-black/60 min-w-[150px] flex flex-col gap-1"
            style={{ top: paneMenu.y, left: paneMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                pushUndoState();
                const newId = `cat-${Date.now()}`;
                setNodes(nds => [...nds, {
                  id: newId, type: 'category', position: paneMenu.pos,
                  data: { label: 'New Category', amount: formatMoney(0, sym), onFocus: pushUndoState }
                }]);
                setPaneMenu(null);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-blue-500/10 text-white/80 hover:text-blue-400 text-xs transition-colors text-left"
            >
              <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
              Add Category Node
            </button>
            <button
              onClick={handleAddFromPane}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-emerald-500/10 text-white/80 hover:text-emerald-400 text-xs transition-colors text-left"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              Add Expense Node
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Node Right-Click Context Menu */}
      <AnimatePresence>
        {nodeMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="absolute z-50 p-1.5 rounded-lg border border-white/15 bg-[#1a1a1f]/95 backdrop-blur-xl shadow-2xl shadow-black/60 min-w-[150px] flex flex-col gap-1"
            style={{ top: nodeMenu.y, left: nodeMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleTogglePaid}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs transition-colors text-left ${
                nodeMenu.paid
                  ? 'hover:bg-red-500/10 text-white/80 hover:text-red-400'
                  : 'hover:bg-emerald-500/10 text-white/80 hover:text-emerald-400'
              }`}
            >
              <CheckCircle className={`w-3.5 h-3.5 ${nodeMenu.paid ? 'text-red-400' : 'text-emerald-400'}`} />
              {nodeMenu.paid ? 'Mark as Unpaid' : 'Mark as Paid'}
            </button>
            <div className="h-px bg-white/10 mx-1" />
            <button
              onClick={handleDeleteNode}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-red-500/10 text-white/80 hover:text-red-400 text-xs transition-colors text-left"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
              Delete Node
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Export Wrapper
// ---------------------------------------------------------------------------

export default function ExpenseMindmap(props) {
  return (
    <ReactFlowProvider>
      <ExpenseMindmapInner {...props} />
    </ReactFlowProvider>
  );
}
