package app.qingqiuyue.desktop

import android.content.Context
import android.webkit.JavascriptInterface
import android.webkit.WebView
import com.tencent.mm.opensdk.modelmsg.SendAuth
import com.tencent.mm.opensdk.openapi.IWXAPI
import com.tencent.mm.opensdk.openapi.WXAPIFactory
import org.json.JSONObject
import java.lang.ref.WeakReference

/**
 * 微信 App SDK 登录(微信开放平台「移动应用」)。
 *
 * 页面经 window.QQNative 调进来:
 *   - wxInstalled():装了微信才显示 SDK 登录,没装走系统浏览器扫码那条老路
 *   - wxLogin(appId, state):跳到微信授权页。appId / state 都由后端 POST /oauth/wx/app/start 发,
 *     appId 不写死在包里 —— 后台 /system/wx-config 换了移动应用不用发版。
 * 微信授权完回到 wxapi.WXEntryActivity,它把 {errCode, code, state} 交给 deliver(),
 * 再经 window.__qqWxAuthResult 回到页面;页面拿 code 去 POST /oauth/wx/app/login 换会话(见 lib/auth/wechatApp.ts)。
 *
 * appId 存一份到 SharedPreferences:微信回调时 WXEntryActivity 可能是冷启动的新进程,内存里的东西都没了。
 */
object WechatLogin {
    private const val PREFS = "qq_wechat"
    private const val KEY_APP_ID = "app_id"
    private val APP_ID_RE = Regex("^wx[0-9a-f]{16}$")

    private var webView: WeakReference<WebView>? = null

    /** MainActivity.onWebViewCreate 里调:挂上 JS 接口(必须在页面加载前)。 */
    fun attach(wv: WebView) {
        webView = WeakReference(wv)
        wv.addJavascriptInterface(Bridge(wv.context.applicationContext), "QQNative")
    }

    /** 用上次发起登录时的 appId 建 API(WXEntryActivity 处理回调用);从没发起过返回 null。 */
    fun api(ctx: Context): IWXAPI? {
        val appId = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_APP_ID, null) ?: return null
        return WXAPIFactory.createWXAPI(ctx, appId, true)
    }

    /** 把微信的授权结果交回页面。errCode:0 成功,-2 用户取消,-4 用户拒绝。 */
    fun deliver(errCode: Int, code: String?, state: String?, errStr: String?) {
        val json = JSONObject()
            .put("errCode", errCode)
            .put("code", code ?: "")
            .put("state", state ?: "")
            .put("errStr", errStr ?: "")
            .toString()
        val wv = webView?.get() ?: return
        wv.post { wv.evaluateJavascript("window.__qqWxAuthResult&&window.__qqWxAuthResult($json)", null) }
    }

    class Bridge(private val ctx: Context) {
        @JavascriptInterface
        fun wxInstalled(): Boolean = try {
            WXAPIFactory.createWXAPI(ctx, null, true).isWXAppInstalled
        } catch (e: Throwable) {
            false
        }

        @JavascriptInterface
        fun wxLogin(appId: String, state: String): Boolean {
            if (!APP_ID_RE.matches(appId) || state.isEmpty()) return false
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_APP_ID, appId).apply()
            val api = WXAPIFactory.createWXAPI(ctx, appId, true)
            if (!api.isWXAppInstalled) return false
            api.registerApp(appId)
            val req = SendAuth.Req().apply {
                scope = "snsapi_userinfo"
                this.state = state
            }
            return api.sendReq(req)
        }
    }
}
