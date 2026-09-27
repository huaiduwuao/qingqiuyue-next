package app.qingqiuyue.desktop.wxapi

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import app.qingqiuyue.desktop.WechatLogin
import com.tencent.mm.opensdk.modelbase.BaseReq
import com.tencent.mm.opensdk.modelbase.BaseResp
import com.tencent.mm.opensdk.modelmsg.SendAuth
import com.tencent.mm.opensdk.openapi.IWXAPIEventHandler

/**
 * 微信授权完成后回调的页面。类名和包名是微信 SDK 规定死的:<applicationId>.wxapi.WXEntryActivity。
 * 本身不显示任何东西(透明主题),把结果交给 WechatLogin.deliver() 就关掉,人回到 MainActivity。
 */
class WXEntryActivity : Activity(), IWXAPIEventHandler {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handle(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handle(intent)
    }

    private fun handle(intent: Intent?) {
        val api = WechatLogin.api(this)
        if (api == null || intent == null || !api.handleIntent(intent, this)) finish()
    }

    override fun onReq(req: BaseReq?) {
        finish()
    }

    override fun onResp(resp: BaseResp?) {
        if (resp is SendAuth.Resp) {
            WechatLogin.deliver(resp.errCode, resp.code, resp.state, resp.errStr)
        }
        finish()
    }
}
