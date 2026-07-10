/** 集中文案/角色选择器，便于后续模块同模式复用。 */
export const S = {
  // reward sidebar
  tabTaskboard: '协作看板',
  // taskboard 视图模式（VIEW_META.label）
  viewMine: '我的任务',
  viewAll: '全部',
  viewTeam: '按团队',
  viewProject: '按项目',
  // 按钮
  newTask: '新建任务',
  refresh: '刷新',
  save: '保存',
  cancel: '取消',
  close: '关闭',
  claim: '我来认领',
  submit: '提交',
  approve: '通过',
  reject: '驳回',
  delete: '删除',
  // 表单 label
  title: '任务标题',
  description: '任务描述',
  groups: '所属团队(可多选)',
  demand: '所属需求(可选)',
  // snackbar 成功文案
  saved: '保存成功',
  statusUpdated: '状态已更新',
  opSuccess: '操作成功',
  deleted: '已删除',
} as const;

/** 生成唯一任务标题，避免并发/重跑互相踩。 */
export function uniqueTitle(prefix = 'E2E') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}
