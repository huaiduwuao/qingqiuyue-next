// PublishForms 共享 props 类型 — 所有 12 个 form 组件接受同样的 prop 形状,
// 由 dispatcher (hd-publish/page.tsx) 注入 onSuccess/onError 回调,屏蔽各
// form 内部"成功后跳回工作台"之类的 side-effect。

export interface PublishFormProps {
  /** 提交成功后回调(由 dispatcher 决定跳哪;默认跳回工作台) */
  onSuccess?: () => void;
  /** 提交失败/校验失败的提示函数(由 dispatcher 注入,以便收集到一个 Snackbar) */
  onError?: (msg: string, severity?: 'warning' | 'error') => void;
}
