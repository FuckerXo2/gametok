#pragma once

#include <string>
#include <vector>
#include <unordered_map>
#include <functional>
#include <memory>
#include <cstdint>

// Forward declarations for Jolt Physics
namespace JPH {
    class PhysicsSystem;
    class TempAllocator;
    class JobSystem;
    class BodyInterface;
    class BodyID;
}

// Forward declarations for Filament
namespace filament {
    class Engine;
    class Renderer;
    class Scene;
    class View;
    class Camera;
    class SwapChain;
    class Skybox;
}

namespace filament::gltfio {
    class AssetLoader;
    class ResourceLoader;
    class MaterialProvider;
    class FilamentAsset;
    class Animator;
}

namespace utils {
    class EntityManager;
    class Entity;
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

struct GameEntity {
    uint64_t id = 0;
    std::string name;
    filament::gltfio::FilamentAsset* asset = nullptr;
    filament::gltfio::Animator* animator = nullptr;
    uint32_t joltBodyId = 0xFFFFFFFF; // JPH::BodyID invalid
    float posX = 0.0f;
    float posY = 0.0f;
    float posZ = 0.0f;
};

class GameTokEngineCore {
public:
    GameTokEngineCore();
    ~GameTokEngineCore();

    // Lifecycle
    bool initialize(void* nativeWindow, const EngineConfig& config = {});
    void resize(int width, int height, float pixelRatio);
    void update(float deltaTime);
    void render();
    void shutdown();

    // Scripting Execution (QuickJS)
    bool loadScript(const std::string& jsCode);
    bool executeScript(const std::string& jsCode);

    // Entity & Asset Management
    uint64_t spawnModel(const std::string& assetUrl, float x, float y, float z);
    uint64_t spawnModelFromBuffer(const uint8_t* data, size_t length, float x, float y, float z);
    bool playAnimation(uint64_t entityId, const std::string& animName, float crossFadeSeconds = 0.2f);
    void setEntityPosition(uint64_t entityId, float x, float y, float z);
    void setEntityVelocity(uint64_t entityId, float vx, float vy, float vz);
    void addEntityForce(uint64_t entityId, float fx, float fy, float fz);

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

    // QuickJS Helper access
    void dispatchScriptEvent(const std::string& eventName, const std::string& payloadJson);

private:
    bool initFilament(void* nativeWindow);
    bool initPhysics();
    bool initScripting();
    void registerScriptBindings();
    void updateEntityTransforms();

    bool initialized_ = false;
    void* nativeWindow_ = nullptr;
    int width_ = 0;
    int height_ = 0;
    float pixelRatio_ = 1.0f;
    float elapsedTime_ = 0.0f;
    EngineConfig config_;

    // Filament rendering handles
    filament::Engine* engine_ = nullptr;
    filament::Renderer* renderer_ = nullptr;
    filament::Scene* scene_ = nullptr;
    filament::View* view_ = nullptr;
    filament::Camera* camera_ = nullptr;
    filament::SwapChain* swapChain_ = nullptr;
    filament::Skybox* skybox_ = nullptr;
    filament::gltfio::AssetLoader* assetLoader_ = nullptr;
    filament::gltfio::ResourceLoader* resourceLoader_ = nullptr;
    filament::gltfio::MaterialProvider* materialProvider_ = nullptr;

    // Camera tracking
    float camEyeX_ = 0.0f, camEyeY_ = 5.0f, camEyeZ_ = -10.0f;
    float camTargetX_ = 0.0f, camTargetY_ = 0.0f, camTargetZ_ = 0.0f;

    // Jolt Physics handles
    std::unique_ptr<JPH::PhysicsSystem> physicsSystem_;
    std::unique_ptr<JPH::TempAllocator> tempAllocator_;
    std::unique_ptr<JPH::JobSystem> jobSystem_;

    // QuickJS runtime handles
    JSRuntime* jsRuntime_ = nullptr;
    JSContext* jsContext_ = nullptr;

    // Entity Map
    std::unordered_map<uint64_t, GameEntity> entities_;

    // UI Callbacks
    std::function<void(int64_t)> scoreCallback_;
    std::function<void(bool won)> gameOverCallback_;
};

} // namespace gametok
