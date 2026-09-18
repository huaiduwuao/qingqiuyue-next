import { adminClient } from '@/lib/api/client';

// 公众号接入(后端 internal/wxmp,/api/core/admin/wx/mp/*,仅管理员)。
// 列表类的增删改查仍走原来的 wx-mp-*.ts;这里是真正和微信服务器打交道的动作。

const unwrap = <T,>(r: any): T => (r?.data ?? r) as T;

export interface WxMpStatus {
  configured: boolean;
  appId?: string;
  /** 服务器配置里的 Token 填了没有(没填则回调验签必然失败) */
  hasToken?: boolean;
  /** 填了 EncodingAESKey,可用安全模式 */
  safeMode?: boolean;
  /** AppID / AppSecret 能换到 access_token */
  tokenOK?: boolean;
  followers?: number;
  miniAppId?: string;
  callbackPath: string;
  message?: string;
}

export async function getWxMpStatus(): Promise<WxMpStatus> {
  return unwrap<WxMpStatus>(await adminClient('/admin/wx/mp/status'));
}

export interface WxMenuNode {
  id: string;
  name: string;
  /** view 跳网页 / miniprogram 跳小程序 / click 点击回复文字;有子菜单的一级菜单不需要 */
  type: string;
  url?: string;
  appid?: string;
  pagepath?: string;
  /** click 菜单被点击时回复的文字 */
  content?: string;
  sub_button?: WxMenuNode[];
}

export async function getWxMenu(): Promise<{ buttons: WxMenuNode[]; message?: string }> {
  return unwrap(await adminClient('/admin/wx/mp/menu'));
}

/** 保存整棵菜单树;publish 为 true 时随后推到微信 */
export async function saveWxMenu(buttons: WxMenuNode[], publish: boolean): Promise<any> {
  return adminClient.post('/admin/wx/mp/menu/save', { buttons, publish });
}

/** 把公众号现有的关注者拉进 wx_user(接入之前就关注的人不会触发关注事件) */
export async function syncWxFollowers(): Promise<{ synced: number }> {
  return unwrap(await adminClient.post('/admin/wx/mp/user/sync', {}));
}

/** 客服消息:只能发给 48 小时内和公众号互动过的人 */
export async function replyWxMsg(openId: string, content: string): Promise<any> {
  return adminClient.post('/admin/wx/mp/msg/reply', { openId, content });
}
