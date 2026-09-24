import ExpoModulesCore
import UIKit
import Metal
import QuartzCore

public class GameTokEngineNativeView: ExpoView {
  private var metalLayer: CAMetalLayer?
  private var displayLink: CADisplayLink?

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    setupMetal()
  }

  private func setupMetal() {
    guard let device = MTLCreateSystemDefaultDevice() else {
      print("❌ [GameTok Metal] Metal is not supported on this device.")
      return
    }

    let layer = CAMetalLayer()
    layer.device = device
    layer.pixelFormat = .bgra8Unorm
    layer.framebufferOnly = true
    layer.contentsScale = UIScreen.main.scale
    self.layer.addSublayer(layer)
    self.metalLayer = layer

    startRenderLoop()
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    metalLayer?.frame = bounds
  }

  private func startRenderLoop() {
    displayLink = CADisplayLink(target: self, selector: #selector(renderFrame))
    displayLink?.preferredFrameRateRange = CAFrameRateRange(minimum: 60, maximum: 120, preferred: 120)
    displayLink?.add(to: .main, forMode: .common)
  }

  @objc private func renderFrame() {
    // Tick game engine loop at 120Hz on ProMotion displays
  }

  public func loadGameScript(_ script: String?) {
    guard let code = script, !code.isEmpty else { return }
    print("📜 [GameTok Native] Loading AI Game Script (length: \(code.count) bytes)")
  }

  public func setCameraMode(_ mode: String) {
    print("📷 [GameTok Native] Camera set to \(mode)")
  }

  public func setGravity(x: Float, y: Float, z: Float) {
    print("🌍 [GameTok Native] Gravity updated: (\(x), \(y), \(z))")
  }

  deinit {
    displayLink?.invalidate()
  }
}
