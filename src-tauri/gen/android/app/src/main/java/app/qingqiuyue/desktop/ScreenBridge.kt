package app.qingqiuyue.desktop

import android.app.Activity
import android.content.pm.ActivityInfo
import android.webkit.JavascriptInterface
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

/**
 * 视频页内全屏(window.QQScreen)。
 *
 * WebView 的元素全屏(requestFullscreen)要宿主实现 WebChromeClient.onShowCustomView,wry 没实现,
 * 所以客户端里播放器的「全屏」按了没反应。前端改成页内全屏(把 <video> 挪进铺满视口的浮层,见
 * components/detail/VideoPlayer 的 PseudoFullscreen),这里配合:藏状态栏 / 导航栏,横屏视频转横屏。
 * 退出时恢复系统栏、方向交还给系统。Manifest 里 configChanges 含 orientation|screenSize,转屏不重建 Activity。
 */
class ScreenBridge(private val activity: Activity) {
  @JavascriptInterface
  fun setFullscreen(on: Boolean, landscape: Boolean) {
    activity.runOnUiThread {
      val window = activity.window
      val ctl = WindowCompat.getInsetsController(window, window.decorView)
      if (on) {
        ctl.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        ctl.hide(WindowInsetsCompat.Type.systemBars())
        activity.requestedOrientation =
          if (landscape) ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
          else ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
      } else {
        ctl.show(WindowInsetsCompat.Type.systemBars())
        activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
      }
    }
  }
}
