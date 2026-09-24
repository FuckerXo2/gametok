package expo.modules.gametokengine

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class GameTokEngineModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("GameTokEngine")

        View(GameTokEngineNativeView::class.java) {
            Prop("gameScript") { view: GameTokEngineNativeView, script: String? ->
                view.loadGameScript(script)
            }

            Prop("cameraMode") { view: GameTokEngineNativeView, mode: String? ->
                view.setCameraMode(mode ?: "3D")
            }

            Prop("gravity") { view: GameTokEngineNativeView, gravity: List<Double>? ->
                if (gravity != null && gravity.size == 3) {
                    view.setGravity(gravity[0].toFloat(), gravity[1].toFloat(), gravity[2].toFloat())
                }
            }
        }
    }
}
