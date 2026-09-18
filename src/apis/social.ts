import { adminClient, homeClient } from '@/lib/api/client';
import type { UserId } from '@/lib/userRoute';

// 用户关系接口:content-api /api/content/home/*(Go: internal/handler/home_social.go)。
// 关注/好友/拉黑的唯一事实来源是 PG user_contact;私信会话列表里的 isFollowed 也从它派生。

export interface UserProfile {
  user: {
    id: number;
    nickname: string;
    avatar: string;
    bio: string;
    isBot: boolean;
    isPrivate: boolean;
  };
  stats: { following: number; followers: number; likes: number; works: number };
  relation: {
    isMe: boolean;
    isFollowing: boolean;
    isFollowedBy: boolean;
    isFriend: boolean;
    friendPending: boolean;
    friendIncoming: boolean;
    isBlocked: boolean;
    /** 未登录、是自己、或任一方拉黑时为 false:主页收起所有关系按钮 */
    canInteract: boolean;
  };
}

export interface UserWork {
  id: number | string;
  title: string;
  cover: string;
  category: string;
  contentType: string;
  views: number;
  likes: number;
  status: string;
}

export async function fetchUserProfile(id: UserId): Promise<UserProfile> {
  return await homeClient.get<UserProfile>(`/user/${id}/profile`);
}

export async function fetchUserWorks(id: UserId, page = 1, pageSize = 24): Promise<{ list: UserWork[]; total: number }> {
  const res = await homeClient.get<any>(`/user/${id}/works`, { params: { page, page_size: pageSize } });
  const d = res.data ?? {};
  return { list: d.list ?? d.records ?? [], total: d.total ?? 0 };
}

export async function followUser(id: UserId): Promise<void> {
  await homeClient.post(`/follow/${id}`);
}

export async function unfollowUser(id: UserId): Promise<void> {
  await homeClient.delete(`/follow/${id}`);
}

export async function addFriend(id: UserId): Promise<void> {
  await homeClient.post(`/friend/${id}`);
}

export async function removeFriend(id: UserId): Promise<void> {
  await homeClient.delete(`/friend/${id}`);
}

export async function blockUser(id: UserId): Promise<void> {
  await homeClient.post(`/block/${id}`);
}

export async function unblockUser(id: UserId): Promise<void> {
  await homeClient.delete(`/block/${id}`);
}

/** 与某用户开始私信:返回(已有或新建的)会话,前端拿 id 打开 /account/msg 的私信页签。 */
export async function openDmSession(userId: UserId): Promise<{ id: number }> {
  return await adminClient.post<{ id: number }>('/msg/session/open', { userId: Number(userId) });
}
