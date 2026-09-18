package app.qingqiuyue.desktop

import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

/**
 * 窗口是 edge-to-edge 的(这里显式开了,targetSdk 35 起系统也会强制),WebView 会一直画到
 * 状态栏底下。问题在于:安卓的 WebView 只把「刘海 / 挖孔」算进 CSS 的 env(safe-area-inset-*),
 * 状态栏和手势条的高度它一概不给 —— 没有刘海的机器上 env() 恒为 0,页面顶部就直接压在状态栏上。
 *
 * 所以这里把系统栏的真实内边距(和刘海取较大值)换算成 CSS px,喂给 --sat-native / --sab-native,
 * globals.css 里 --sat / --sab 优先读它们。前端已有十几处在用 var(--sat),一处补齐、全站生效。
 */
class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)

    val content = findViewById<View>(android.R.id.content)
    ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
      val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
      val cutout = insets.getInsets(WindowInsetsCompat.Type.displayCutout())
      val density = resources.displayMetrics.density.takeIf { it > 0f } ?: 1f
      val top = (maxOf(bars.top, cutout.top) / density).toInt()
      val bottom = (maxOf(bars.bottom, cutout.bottom) / density).toInt()
      findWebView(view)?.evaluateJavascript(
        "document.documentElement.style.setProperty('--sat-native','${top}px');" +
          "document.documentElement.style.setProperty('--sab-native','${bottom}px');",
        null,
      )
      // 不吞掉,继续往下派发,免得影响 Tauri 自己对 inset 的处理
      insets
    }
  }

  // WebView 是 Tauri 在 onCreate 之后才挂上来的,而且页面整体重载会清掉上面注入的变量。
  // 每次回到前台重新请求一遍 inset,借 listener 再注入一次。
  override fun onResume() {
    super.onResume()
    findViewById<View>(android.R.id.content)?.requestApplyInsets()
  }

  private fun findWebView(view: View): WebView? {
    if (view is WebView) return view
    if (view is ViewGroup) {
      for (i in 0 until view.childCount) {
        findWebView(view.getChildAt(i))?.let { return it }
      }
    }
    return null
  }
}
