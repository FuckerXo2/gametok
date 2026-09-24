#pragma once

#include <string>
#include <vector>
#include <functional>
#include <memory>
#include <cstdint>

// Forward declarations
namespace JPH {
    class PhysicsSystem;
    class TempAllocator;
    class JobSystem;
    class BodyInterface;
}

struct JSRuntime;
struct JSContext;

namespace gametok {

enum class CameraMode {
    Perspective3D,
    Orthographic2D
};

struct EngineConfig {
    CameraMode cameraMode = CameraMode::Perspective3D;
    float gravityX = 0.0f;
    float gravityY = -9.81f;
    float gravityZ = 0.0f;
    uint32_t targetFps = 60;
};

class GameTokEngineCore {
public:
    GameTokEngineCore();
    ~GameTokEngineCore();

    // Lifecycle
    bool initialize(const EngineConfig& config = {});
    void resize(int width, int height, float pixelRatio);
    void update(float deltaTime);
    void render();
    void shutdown();

    // Scripting Execution (QuickJS)
    bool loadScript(const std::string& jsCode);
    bool executeScript(const std::string& jsCode);

    // Entity & Asset Management
    uint64_t spawnModel(const std::string& assetUrl, float x, float y, float z);
    bool playAnimation(uint64_t entityId, const std::string& animName, float crossFadeSeconds = 0.2f);
    void setEntityPosition(uint64_t entityId, float x, float y, float z);

    // Camera & Mode Controls
    void setCameraMode(CameraMode mode);
    void setCameraPosition(float x, float y, float z);
    void setCameraTarget(float x, float y, float z);

    // Input Events from Mobile Touch UI
    void handleTouchDown(float x, float y, int pointerId);
    void handleTouchMove(float x, float y, int pointerId);
    void handleTouchUp(float x, float y, int pointerId);
    void handleJoystickInput(float dirX, float dirY);
    void handleAction(const std::string& actionName);

    // Callbacks to UI
    void setScoreCallback(std::function<void(int64_t)> cb) { scoreCallback_ = cb; }
    void setGameOverCallback(std::function<void(bool won)> cb) { gameOverCallback_ = cb; }

    bool isInitialized() const { return initialized_; }

private:
    bool initPhysics();
    bool initScripting();
    void registerScriptBindings();

    bool initialized_ = false;
    int width_ = 0;
    int height_ = 0;
    float pixelRatio_ = 1.0f;
    EngineConfig config_;

    // Jolt Physics handles
    std::unique_ptr<JPH::PhysicsSystem> physicsSystem_;
    std::unique_ptr<JPH::TempAllocator> tempAllocator_;
    std::unique_ptr<JPH::JobSystem> jobSystem_;

    // QuickJS runtime handles
    JSRuntime* jsRuntime_ = nullptr;
    JSContext* jsContext_ = nullptr;

    // UI Callbacks
    std::function<void(int64_t)> scoreCallback_;
    std::function<void(bool won)> gameOverCallback_;
};

} // namespace gametok
