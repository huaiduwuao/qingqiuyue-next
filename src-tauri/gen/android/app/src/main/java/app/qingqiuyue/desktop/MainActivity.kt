package app.qingqiuyue.desktop

import android.os.Bundle
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
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
  private var webView: WebView? = null
  private var lastBackAt = 0L

  /**
   * 返回键 / 返回手势。OnBackPressedDispatcher 里最后注册的回调最先执行;Tauri 的 AppPlugin 自己也注册了一个
   * (能后退就后退,退到头直接 finish()),而且它是在 WebView 建好、插件加载时才注册的 —— 比我们在 onCreate 里
   * 注册得晚,于是它先接到返回、我们的「再按一次退出」根本轮不到(2026-09-28 用户反馈没有两次返回退出)。
   * 所以在 onCreate、WebView 建好之后、每次回到前台都重新挂一次,保证我们的永远在最上面。
   */
  private val backCallback = object : OnBackPressedCallback(true) {
    override fun handleOnBackPressed() {
      val wv = webView
      if (wv == null) {
        exitOnSecondPress()
        return
      }
      wv.evaluateJavascript(
        "(function(){try{return window.__qqBack?window.__qqBack():''}catch(e){return ''}})()",
      ) { result ->
        when (result?.trim('"')) {
          "handled" -> {}
          "root" -> exitOnSecondPress()
          else -> if (wv.canGoBack()) wv.goBack() else exitOnSecondPress()
        }
      }
    }
  }

  private fun registerBackCallback() {
    backCallback.remove()
    onBackPressedDispatcher.addCallback(this, backCallback)
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)

    // 返回键 / 返回手势(见 backCallback),先问页面(components/client/BackKeyBridge 的 window.__qqBack):
    // - handled:页面自己关掉了抽屉/弹窗
    // - root:在一级页面(底部导航露着)→ 提示「再按一次退出」,两秒内再按才退到后台
    //   (moveTaskToBack,不销毁,再打开是秒开)
    // - 其它:能后退就后退,退到头同样提示退出
    // 以前只看 canGoBack():单页应用切过页签、看过详情,历史栈一直有东西,首页上按返回只会一层层往回退,
    // 永远走不到「再按一次退出」。
    registerBackCallback()

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

  /**
   * wry 建好 WebView、还没加载首页时回调这里(见 wry WryActivity.setWebView)。
   *
   * - UA 去掉 " Mobile":推荐流几乎全是 B 站外链播放器,它的 player.html 只要 UA 匹配
   *   /AppleWebKit.*Mobile/ 就跳去移动版 mbplayer.html,而移动版在第三方页面里只放
   *   「视频无法播放」的 error.mp4(2026-09-25 用正常投稿实测;同一地址桌面 UA 能自动播放)。
   *   去掉 Mobile 就是安卓平板的 UA,Android 字样还在,前端 authPlatform() 照样认得出安卓;
   *   本站的手机/平板布局按屏宽走,不看 UA。
   * - 自动播放不要求手势:wry 默认已经这么设了,这里显式再设一次,不依赖它的默认值。
   * - offscreenPreRaster:WebView 常驻前台,预先栅格化视口外一圈内容,快速滑动时少白块。
   */
  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    this.webView = webView
    // 微信 App SDK 登录的 JS 接口(window.QQNative),必须在页面加载前挂上
    WechatLogin.attach(webView)
    // 视频页内全屏时藏系统栏 / 转横屏(window.QQScreen,见 ScreenBridge)
    webView.addJavascriptInterface(ScreenBridge(this), "QQScreen")
    val settings = webView.settings
    settings.userAgentString = settings.userAgentString.replace(" Mobile", "")
    settings.mediaPlaybackRequiresUserGesture = false
    settings.offscreenPreRaster = true
    // Tauri 的插件(含 AppPlugin 的返回回调)在 WebView 建好之后才加载,等它们挂完再把我们的挪到最上面
    webView.post { registerBackCallback() }
    webView.postDelayed({ registerBackCallback() }, 1500)
  }

  // WebView 是 Tauri 在 onCreate 之后才挂上来的,而且页面整体重载会清掉上面注入的变量。
  // 每次回到前台重新请求一遍 inset,借 listener 再注入一次。
  override fun onResume() {
    super.onResume()
    registerBackCallback()
    findViewById<View>(android.R.id.content)?.requestApplyInsets()
  }

  private fun exitOnSecondPress() {
    val now = SystemClock.elapsedRealtime()
    if (now - lastBackAt < 2000) {
      lastBackAt = 0L
      moveTaskToBack(true)
    } else {
      lastBackAt = now
      Toast.makeText(this, "再按一次退出清秋月", Toast.LENGTH_SHORT).show()
    }
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
