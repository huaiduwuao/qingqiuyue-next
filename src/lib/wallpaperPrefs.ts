/**
 * 壁纸收藏 / 「我的壁纸」/ 已应用壁纸 —— 只存本机(按用户 id 分开)。
 *
 * 后端 PUT /api/admin/user/profile(UserHandler.UpdateMe)只认 nickname/avatar/email/
 * mobile/info/password,favoriteWallpapers / savedWallpapers / homeWallpaper /
 * profileWallpaper 会被静默丢弃却照样回「更新成功」,而且没带 info 时会把个人简介清空。
 * 后端没有任何持久化壁纸偏好的字段或接口之前,这里只做本机存储。
 */
export interface WallpaperPrefs {
  favorites: string[];
  mine: { id: string; appliedTo: 'home' | 'account' | 'none'; setAt: string }[];
}

const EMPTY: WallpaperPrefs = { favorites: [], mine: [] };

function keyOf(userId: string | number): string {
  return `qq-wallpaper-prefs:${userId}`;
}

export function loadWallpaperPrefs(userId: string | number | null | undefined): WallpaperPrefs {
  if (userId == null || userId === '') return EMPTY;
  try {
    const raw = localStorage.getItem(keyOf(userId));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<WallpaperPrefs>;
    const favorites = Array.isArray(parsed.favorites) ? parsed.favorites.filter((x): x is string => typeof x === 'string') : [];
    const mine = Array.isArray(parsed.mine)
      ? parsed.mine.filter(
          (m): m is WallpaperPrefs['mine'][number] =>
            !!m && typeof m.id === 'string' && (m.appliedTo === 'home' || m.appliedTo === 'account' || m.appliedTo === 'none'),
        )
      : [];
    return { favorites, mine };
  } catch {
    return EMPTY;
  }
}

/** 写入失败(存储被禁用 / 配额满)抛错,由调用方回滚界面并提示。 */
export function saveWallpaperPrefs(userId: string | number, prefs: WallpaperPrefs): void {
  localStorage.setItem(keyOf(userId), JSON.stringify(prefs));
}
