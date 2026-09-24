import ExpoModulesCore

public class GameTokEngineModule: Module {
  public func definition() -> ModuleDefinition {
    Name("GameTokEngine")

    View(GameTokEngineNativeView.self) {
      Prop("gameScript") { (view: GameTokEngineNativeView, script: String?) in
        view.loadGameScript(script)
      }

      Prop("cameraMode") { (view: GameTokEngineNativeView, mode: String?) in
        view.setCameraMode(mode ?? "3D")
      }

      Prop("gravity") { (view: GameTokEngineNativeView, gravity: [Double]?) in
        if let g = gravity, g.count == 3 {
          view.setGravity(x: Float(g[0]), y: Float(g[1]), z: Float(g[2]))
        }
      }
    }
  }
}
