package expo.modules.gametokengine

import android.content.Context
import android.util.Log
import android.view.SurfaceView
import android.widget.FrameLayout
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

class GameTokEngineNativeView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
    private val surfaceView: SurfaceView = SurfaceView(context)

    init {
        val params = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        )
        addView(surfaceView, params)
        Log.d("GameTokEngine", "🚀 Native SurfaceView initialized for Vulkan/OpenGL")
    }

    fun loadGameScript(script: String?) {
        if (!script.isNullOrEmpty()) {
            Log.d("GameTokEngine", "📜 Loading AI Game Script (length: ${script.length})")
        }
    }

    fun setCameraMode(mode: String) {
        Log.d("GameTokEngine", "📷 Camera set to $mode")
    }

    fun setGravity(x: Float, y: Float, z: Float) {
        Log.d("GameTokEngine", "🌍 Gravity updated: ($x, $y, $z)")
    }
}
