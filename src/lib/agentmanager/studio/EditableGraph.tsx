'use client'

/**
 * 可编辑画布(工作室通用)
 * 对话生成只是把内容「灌进草稿」,用户在画布上主动修改后才保存。
 * 能力:拖动位置 / 连线 / 删线 / Delete 删节点 / 工具条加节点 / 双击节点编辑名称+配置。
 * 通过 ref 暴露 setData(外部灌入 LLM 生成结果),onChange 把草稿同步给父组件。
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'

export interface DraftNode {
  id: string
  label: string
  sub?: string
  kind?: string
  x: number
  y: number
  config?: Record<string, any>
}

export interface DraftEdge {
  id: string
  source: string
  target: string
  label?: string
}

export interface EditableGraphRef {
  /** 外部灌入草稿(如 LLM 生成结果),替换当前画布 */
  setData: (nodes: DraftNode[], edges: DraftEdge[]) => void
  /** 读取当前草稿 */
  getData: () => { nodes: DraftNode[]; edges: DraftEdge[] }
}

interface EditableGraphProps {
  /** 工具条可添加的节点类型 */
  palette: { kind: string; label: string }[]
  /** 草稿变化回调 */
  onChange?: (nodes: DraftNode[], edges: DraftEdge[]) => void
  emptyHint?: string
}

const KIND_COLOR: Record<string, { bg: string; border: string; fg: string }> = {
  start: { bg: '#e8f5e9', border: '#66bb6a', fg: '#2e7d32' },
  end: { bg: '#ffebee', border: '#ef5350', fg: '#c62828' },
  agent: { bg: '#e3f2fd', border: '#42a5f5', fg: '#1565c0' },
  skill: { bg: '#f3e5f5', border: '#ab47bc', fg: '#6a1b9a' },
  workflow: { bg: '#fff3e0', border: '#ffa726', fg: '#e65100' },
  mcp: { bg: '#e0f7fa', border: '#26c6da', fg: '#00838f' },
  memory: { bg: '#fffde7', border: '#ffee58', fg: '#f9a825' },
  step: { bg: '#eceff1', border: '#90a4ae', fg: '#37474f' },
  io: { bg: '#fafafa', border: '#bdbdbd', fg: '#616161' },
  condition: { bg: '#fce4ec', border: '#f06292', fg: '#ad1457' },
}

let idSeq = 1
const nid = () => `n${Date.now().toString(36)}${idSeq++}`

const EditableGraph = forwardRef<EditableGraphRef, EditableGraphProps>(function EditableGraph(
  { palette, onChange, emptyHint },
  ref,
) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [editingNode, setEditingNode] = useState<Node | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editConfig, setEditConfig] = useState('{}')

  // 把 RF 状态转成草稿
  const toDraft = useCallback((): { nodes: DraftNode[]; edges: DraftEdge[] } => {
    return {
      nodes: nodes.map((n) => ({
        id: n.id,
        label: (n.data.label as string) ?? n.id,
        sub: n.data.sub as string,
        kind: n.data.kind as string,
        x: n.position.x,
        y: n.position.y,
        config: (n.data.config as Record<string, any>) ?? {},
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label as string,
      })),
    }
  }, [nodes, edges])

  // 灌入草稿
  const setData = useCallback(
    (dns: DraftNode[], des: DraftEdge[]) => {
      setNodes(
        dns.map((n) => makeRFNode(n)),
      )
      setEdges(
        des.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: '#90a4ae' },
        })),
      )
    },
    [setNodes, setEdges],
  )

  useImperativeHandle(ref, () => ({ setData, getData: toDraft }), [setData, toDraft])

  // 草稿变化通知父组件
  useEffect(() => {
    const d = toDraft()
    onChange?.(d.nodes, d.edges)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges])

  const onConnect = useCallback(
    (conn: Connection) =>
      setEdges((eds) => addEdge({ ...conn, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: '#90a4ae' } }, eds)),
    [setEdges],
  )

  // 工具条加节点
  const addNode = useCallback(
    (kind: string, label: string) => {
      const id = nid()
      setNodes((nds) => [
        ...nds,
        makeRFNode({
          id,
          label,
          kind,
          x: 120 + Math.random() * 240,
          y: 80 + Math.random() * 160,
          config: {},
        }),
      ])
    },
    [setNodes],
  )

  // 双击节点编辑
  const onNodeDoubleClick = useCallback((_: any, node: Node) => {
    setEditingNode(node)
    setEditLabel((node.data.label as string) ?? '')
    setEditConfig(JSON.stringify((node.data.config as Record<string, any>) ?? {}, null, 2))
  }, [])

  const saveNodeEdit = useCallback(() => {
    if (!editingNode) return
    let cfg: Record<string, any> = {}
    try {
      cfg = JSON.parse(editConfig || '{}')
    } catch {
      alert('配置不是合法 JSON')
      return
    }
    setNodes((nds) =>
      nds.map((n) =>
        n.id === editingNode.id ? { ...n, data: { ...n.data, label: editLabel, config: cfg } } : n,
      ),
    )
    setEditingNode(null)
  }, [editingNode, editLabel, editConfig, setNodes])

  const deleteEditingNode = useCallback(() => {
    if (!editingNode) return
    setNodes((nds) => nds.filter((n) => n.id !== editingNode.id))
    setEdges((eds) => eds.filter((e) => e.source !== editingNode.id && e.target !== editingNode.id))
    setEditingNode(null)
  }, [editingNode, setNodes, setEdges])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 1 }}>
      {/* 工具条 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', flex: '0 0 auto' }}>
        <Typography variant="caption" color="text.secondary">添加节点:</Typography>
        {palette.map((p) => (
          <Button key={p.kind} size="small" variant="outlined" onClick={() => addNode(p.kind, p.label)}>
            + {p.label}
          </Button>
        ))}
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.disabled">
          拖动移动 · 拖出连线 · 双击改配置 · 选中按 Delete 删除
        </Typography>
      </Box>

      {/* 画布 */}
      <Box sx={{ flex: 1, minHeight: 0, border: '1px solid #eee', borderRadius: 1, overflow: 'hidden', bgcolor: '#fdfdfd' }}>
        {nodes.length === 0 ? (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9e9e9e', fontSize: 14 }}>
            {emptyHint ?? '用左侧对话生成草稿,或点上方按钮手动添加节点'}
          </Box>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDoubleClick={onNodeDoubleClick}
            fitView
            deleteKeyCode={['Backspace', 'Delete']}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={16} />
            <Controls />
            <MiniMap pannable zoomable style={{ width: 120, height: 80 }} />
          </ReactFlow>
        )}
      </Box>

      {/* 节点配置编辑对话框 */}
      <Dialog open={!!editingNode} onClose={() => setEditingNode(null)} maxWidth="sm" fullWidth>
        <DialogTitle>编辑节点</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="名称" size="small" fullWidth value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
          <TextField
            label="配置 (JSON)"
            size="small"
            fullWidth
            multiline
            rows={8}
            value={editConfig}
            onChange={(e) => setEditConfig(e.target.value)}
            slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: 12 } } }}
          />
        </DialogContent>
        <DialogActions>
          <Button color="error" onClick={deleteEditingNode}>删除节点</Button>
          <Box sx={{ flex: 1 }} />
          <Button onClick={() => setEditingNode(null)}>取消</Button>
          <Button variant="contained" onClick={saveNodeEdit}>保存</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
})

function makeRFNode(n: DraftNode): Node {
  const c = KIND_COLOR[n.kind ?? 'step'] ?? KIND_COLOR.step
  return {
    id: n.id,
    position: { x: n.x, y: n.y },
    data: { label: n.label, sub: n.sub, kind: n.kind, config: n.config ?? {} },
    type: 'default',
    style: {
      background: c.bg,
      border: `1.5px solid ${c.border}`,
      color: c.fg,
      borderRadius: 8,
      padding: '8px 12px',
      minWidth: 120,
      fontSize: 12,
    },
  }
}

export default EditableGraph
