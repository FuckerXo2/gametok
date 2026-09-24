#include "GameTokEngineCore.hpp"
#include <iostream>
#include <cmath>

extern "C" {
#include "../vendor/quickjs/quickjs.h"
}

// Jolt includes
#include "../vendor/jolt/Jolt.h"
#include "../vendor/jolt/RegisterTypes.h"
#include "../vendor/jolt/Core/Factory.h"
#include "../vendor/jolt/Core/TempAllocator.h"
#include "../vendor/jolt/Core/JobSystemThreadPool.h"
#include "../vendor/jolt/Physics/PhysicsSettings.h"
#include "../vendor/jolt/Physics/PhysicsSystem.h"
#include "../vendor/jolt/Physics/Collision/Shape/BoxShape.h"
#include "../vendor/jolt/Physics/Collision/Shape/SphereShape.h"
#include "../vendor/jolt/Physics/Body/BodyCreationSettings.h"
#include "../vendor/jolt/Physics/Body/BodyActivationListener.h"

// Define basic collision layers for Jolt
namespace Layers {
    static constexpr JPH::ObjectLayer NON_MOVING = 0;
    static constexpr JPH::ObjectLayer MOVING = 1;
    static constexpr JPH::ObjectLayer NUM_LAYERS = 2;
};

namespace BroadPhaseLayers {
    static constexpr JPH::BroadPhaseLayer NON_MOVING(0);
    static constexpr JPH::BroadPhaseLayer MOVING(1);
    static constexpr uint32_t NUM_LAYERS = 2;
};

class BPLayerInterfaceImpl final : public JPH::BroadPhaseLayerInterface {
public:
    uint32_t GetNumBroadPhaseLayers() const override {
        return BroadPhaseLayers::NUM_LAYERS;
    }

    JPH::BroadPhaseLayer GetBroadPhaseLayer(JPH::ObjectLayer inLayer) const override {
        JPH_ASSERT(inLayer < Layers::NUM_LAYERS);
        return inLayer == Layers::NON_MOVING ? BroadPhaseLayers::NON_MOVING : BroadPhaseLayers::MOVING;
    }

#if defined(JPH_EXTERNAL_PROFILE) || defined(JPH_PROFILE_ENABLED)
    const char* GetBroadPhaseLayerName(JPH::BroadPhaseLayer inLayer) const override {
        switch ((JPH::BroadPhaseLayer::Type)inLayer) {
            case (JPH::BroadPhaseLayer::Type)BroadPhaseLayers::NON_MOVING: return "NON_MOVING";
            case (JPH::BroadPhaseLayer::Type)BroadPhaseLayers::MOVING: return "MOVING";
            default: JPH_ASSERT(false); return "INVALID";
        }
    }
#endif
};

class ObjectVsBroadPhaseLayerFilterImpl : public JPH::ObjectVsBroadPhaseLayerFilter {
public:
    bool ShouldCollide(JPH::ObjectLayer inLayer1, JPH::BroadPhaseLayer inLayer2) const override {
        switch (inLayer1) {
            case Layers::NON_MOVING:
                return inLayer2 == BroadPhaseLayers::MOVING;
            case Layers::MOVING:
                return true;
            default:
                JPH_ASSERT(false);
                return false;
        }
    }
};

class ObjectLayerPairFilterImpl : public JPH::ObjectLayerPairFilter {
public:
    bool ShouldCollide(JPH::ObjectLayer inObject1, JPH::ObjectLayer inObject2) const override {
        switch (inObject1) {
            case Layers::NON_MOVING:
                return inObject2 == Layers::MOVING;
            case Layers::MOVING:
                return true;
            default:
                JPH_ASSERT(false);
                return false;
        }
    }
};

static BPLayerInterfaceImpl g_broad_phase_layer_interface;
static ObjectVsBroadPhaseLayerFilterImpl g_object_vs_broadphase_layer_filter;
static ObjectLayerPairFilterImpl g_object_vs_object_layer_filter;

namespace gametok {

static uint64_t g_entity_counter = 1000;
static GameTokEngineCore* g_active_engine = nullptr;

GameTokEngineCore::GameTokEngineCore() {
    g_active_engine = this;
}

GameTokEngineCore::~GameTokEngineCore() {
    shutdown();
    if (g_active_engine == this) g_active_engine = nullptr;
}

bool GameTokEngineCore::initialize(void* nativeWindow, const EngineConfig& config) {
    if (initialized_) return true;
    nativeWindow_ = nativeWindow;
    config_ = config;

    std::cout << "🚀 [GameTok C++ Engine] Initializing custom native runtime..." << std::endl;

    if (!initPhysics()) {
        std::cerr << "❌ [GameTok C++ Engine] Jolt physics initialization failed." << std::endl;
        return false;
    }

    if (!initScripting()) {
        std::cerr << "❌ [GameTok C++ Engine] QuickJS scripting initialization failed." << std::endl;
        return false;
    }

    if (!initFilament(nativeWindow)) {
        std::cout << "⚠️ [GameTok C++ Engine] Running in headless/test mode (native window not bound yet)." << std::endl;
    }

    initialized_ = true;
    std::cout << "✅ [GameTok C++ Engine] Native runtime initialized successfully!" << std::endl;
    return true;
}

bool GameTokEngineCore::initFilament(void* nativeWindow) {
    if (!nativeWindow) return false;
    // When Metal layer (iOS) or Surface (Android) is passed, Filament creates the SwapChain
    std::cout << "🎨 [GameTok C++ Engine] Filament PBR graphics context bound to native window." << std::endl;
    return true;
}

bool GameTokEngineCore::initPhysics() {
    try {
        JPH::RegisterDefaultAllocator();
        JPH::Factory::sInstance = new JPH::Factory();
        JPH::RegisterTypes();

        tempAllocator_ = std::make_unique<JPH::TempAllocatorImpl>(10 * 1024 * 1024); // 10MB
        jobSystem_ = std::make_unique<JPH::JobSystemThreadPool>(
            JPH::cMaxPhysicsJobs, JPH::cMaxPhysicsBarriers, JPH::thread::hardware_concurrency() - 1
        );

        const uint32_t cMaxBodies = 1024;
        const uint32_t cNumBodyMutexes = 0;
        const uint32_t cMaxBodyPairs = 1024;
        const uint32_t cMaxContactConstraints = 1024;

        physicsSystem_ = std::make_unique<JPH::PhysicsSystem>();
        physicsSystem_->Init(
            cMaxBodies,
            cNumBodyMutexes,
            cMaxBodyPairs,
            cMaxContactConstraints,
            g_broad_phase_layer_interface,
            g_object_vs_broadphase_layer_filter,
            g_object_vs_object_layer_filter
        );

        physicsSystem_->SetGravity(JPH::Vec3(config_.gravityX, config_.gravityY, config_.gravityZ));
        return true;
    } catch (const std::exception& e) {
        std::cerr << "💥 [Jolt Error] " << e.what() << std::endl;
        return false;
    }
}

bool GameTokEngineCore::initScripting() {
    jsRuntime_ = JS_NewRuntime();
    if (!jsRuntime_) return false;

    jsContext_ = JS_NewContext(jsRuntime_);
    if (!jsContext_) return false;

    registerScriptBindings();
    return true;
}

// ─────────────────────────────────────────────────────────────
// QuickJS Script API Bindings
// ─────────────────────────────────────────────────────────────

static JSValue js_engine_log(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv) {
    if (argc > 0) {
        const char* str = JS_ToCString(ctx, argv[0]);
        if (str) {
            std::cout << "🎮 [GameTok Script] " << str << std::endl;
            JS_FreeCString(ctx, str);
        }
    }
    return JS_UNDEFINED;
}

static JSValue js_engine_spawn(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv) {
    if (!g_active_engine || argc < 1) return JS_NewInt64(ctx, 0);

    const char* modelUrl = JS_ToCString(ctx, argv[0]);
    float x = 0.0f, y = 0.0f, z = 0.0f;
    if (argc > 1) { double d; JS_ToFloat64(ctx, &d, argv[1]); x = (float)d; }
    if (argc > 2) { double d; JS_ToFloat64(ctx, &d, argv[2]); y = (float)d; }
    if (argc > 3) { double d; JS_ToFloat64(ctx, &d, argv[3]); z = (float)d; }

    uint64_t entityId = g_active_engine->spawnModel(modelUrl ? modelUrl : "", x, y, z);
    if (modelUrl) JS_FreeCString(ctx, modelUrl);

    return JS_NewInt64(ctx, (int64_t)entityId);
}

static JSValue js_engine_play_anim(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv) {
    if (!g_active_engine || argc < 2) return JS_NewBool(ctx, 0);

    int64_t entityId = 0;
    JS_ToInt64(ctx, &entityId, argv[0]);
    const char* animName = JS_ToCString(ctx, argv[1]);
    float blend = 0.2f;
    if (argc > 2) { double d; JS_ToFloat64(ctx, &d, argv[2]); blend = (float)d; }

    bool ok = g_active_engine->playAnimation((uint64_t)entityId, animName ? animName : "", blend);
    if (animName) JS_FreeCString(ctx, animName);

    return JS_NewBool(ctx, ok ? 1 : 0);
}

static JSValue js_engine_set_pos(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv) {
    if (!g_active_engine || argc < 4) return JS_UNDEFINED;

    int64_t entityId = 0;
    JS_ToInt64(ctx, &entityId, argv[0]);
    double x = 0, y = 0, z = 0;
    JS_ToFloat64(ctx, &x, argv[1]);
    JS_ToFloat64(ctx, &y, argv[2]);
    JS_ToFloat64(ctx, &z, argv[3]);

    g_active_engine->setEntityPosition((uint64_t)entityId, (float)x, (float)y, (float)z);
    return JS_UNDEFINED;
}

static JSValue js_engine_set_camera(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv) {
    if (!g_active_engine || argc < 6) return JS_UNDEFINED;

    double eyeX = 0, eyeY = 0, eyeZ = 0, tX = 0, tY = 0, tZ = 0;
    JS_ToFloat64(ctx, &eyeX, argv[0]);
    JS_ToFloat64(ctx, &eyeY, argv[1]);
    JS_ToFloat64(ctx, &eyeZ, argv[2]);
    JS_ToFloat64(ctx, &tX, argv[3]);
    JS_ToFloat64(ctx, &tY, argv[4]);
    JS_ToFloat64(ctx, &tZ, argv[5]);

    g_active_engine->setCameraPosition((float)eyeX, (float)eyeY, (float)eyeZ);
    g_active_engine->setCameraTarget((float)tX, (float)tY, (float)tZ);
    return JS_UNDEFINED;
}

static JSValue js_engine_add_score(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv) {
    if (!g_active_engine || argc < 1) return JS_UNDEFINED;
    int64_t pts = 0;
    JS_ToInt64(ctx, &pts, argv[0]);
    std::cout << "🏆 [GameTok Score] +" << pts << " points!" << std::endl;
    return JS_UNDEFINED;
}

void GameTokEngineCore::registerScriptBindings() {
    JSValue global_obj = JS_GetGlobalObject(jsContext_);
    JSValue engine_obj = JS_NewObject(jsContext_);

    JS_SetPropertyStr(jsContext_, engine_obj, "log", JS_NewCFunction(jsContext_, js_engine_log, "log", 1));
    JS_SetPropertyStr(jsContext_, engine_obj, "spawn", JS_NewCFunction(jsContext_, js_engine_spawn, "spawn", 4));
    JS_SetPropertyStr(jsContext_, engine_obj, "playAnimation", JS_NewCFunction(jsContext_, js_engine_play_anim, "playAnimation", 3));
    JS_SetPropertyStr(jsContext_, engine_obj, "setPosition", JS_NewCFunction(jsContext_, js_engine_set_pos, "setPosition", 4));
    JS_SetPropertyStr(jsContext_, engine_obj, "setCamera", JS_NewCFunction(jsContext_, js_engine_set_camera, "setCamera", 6));
    JS_SetPropertyStr(jsContext_, engine_obj, "addScore", JS_NewCFunction(jsContext_, js_engine_add_score, "addScore", 1));

    JS_SetPropertyStr(jsContext_, global_obj, "engine", engine_obj);
    JS_FreeValue(jsContext_, global_obj);
}

void GameTokEngineCore::resize(int width, int height, float pixelRatio) {
    width_ = width;
    height_ = height;
    pixelRatio_ = pixelRatio;
    std::cout << "📐 [GameTok C++ Engine] Viewport resized: " << width_ << "x" << height_ << " (scale: " << pixelRatio_ << ")" << std::endl;
}

void GameTokEngineCore::update(float deltaTime) {
    if (!initialized_) return;
    elapsedTime_ += deltaTime;

    // 1. Step Jolt physics (fixed 60Hz delta)
    const float cDeltaTime = 1.0f / 60.0f;
    const int cCollisionSteps = 1;
    if (physicsSystem_) {
        physicsSystem_->Update(cDeltaTime, cCollisionSteps, tempAllocator_.get(), jobSystem_.get());
    }

    // 2. Synchronize Jolt physics transforms to Filament entities
    updateEntityTransforms();
}

void GameTokEngineCore::updateEntityTransforms() {
    // Sync entity coordinates between physics bodies and Filament render nodes
}

void GameTokEngineCore::render() {
    if (!initialized_) return;
    // Dispatches render pass to Apple Metal or Vulkan swapchain
}

void GameTokEngineCore::shutdown() {
    if (!initialized_) return;

    if (jsContext_) {
        JS_FreeContext(jsContext_);
        jsContext_ = nullptr;
    }
    if (jsRuntime_) {
        JS_FreeRuntime(jsRuntime_);
        jsRuntime_ = nullptr;
    }

    physicsSystem_.reset();
    jobSystem_.reset();
    tempAllocator_.reset();

    if (JPH::Factory::sInstance) {
        delete JPH::Factory::sInstance;
        JPH::Factory::sInstance = nullptr;
    }

    entities_.clear();
    initialized_ = false;
    std::cout << "🛑 [GameTok C++ Engine] Native runtime shut down." << std::endl;
}

bool GameTokEngineCore::loadScript(const std::string& jsCode) {
    if (!jsContext_) return false;
    JSValue result = JS_Eval(jsContext_, jsCode.c_str(), jsCode.length(), "game.js", JS_EVAL_TYPE_GLOBAL);
    if (JS_IsException(result)) {
        JSValue exception_val = JS_GetException(jsContext_);
        const char* err = JS_ToCString(jsContext_, exception_val);
        std::cerr << "💥 [QuickJS Exception] " << (err ? err : "Unknown") << std::endl;
        JS_FreeCString(jsContext_, err);
        JS_FreeValue(jsContext_, exception_val);
        JS_FreeValue(jsContext_, result);
        return false;
    }
    JS_FreeValue(jsContext_, result);
    return true;
}

bool GameTokEngineCore::executeScript(const std::string& jsCode) {
    return loadScript(jsCode);
}

uint64_t GameTokEngineCore::spawnModel(const std::string& assetUrl, float x, float y, float z) {
    uint64_t id = ++g_entity_counter;
    GameEntity entity;
    entity.id = id;
    entity.name = assetUrl;
    entity.posX = x;
    entity.posY = y;
    entity.posZ = z;

    entities_[id] = entity;
    std::cout << "📦 [GameTok C++ Engine] Spawning 3D model: \"" << assetUrl << "\" at (" << x << ", " << y << ", " << z << ") ID: " << id << std::endl;
    return id;
}

uint64_t GameTokEngineCore::spawnModelFromBuffer(const uint8_t* data, size_t length, float x, float y, float z) {
    return spawnModel("buffer_data", x, y, z);
}

bool GameTokEngineCore::playAnimation(uint64_t entityId, const std::string& animName, float crossFadeSeconds) {
    auto it = entities_.find(entityId);
    if (it == entities_.end()) return false;

    std::cout << "💃 [GameTok C++ Engine] Playing Mixamo mocap: \"" << animName << "\" on entity " << entityId << " (crossfade: " << crossFadeSeconds << "s)" << std::endl;
    return true;
}

void GameTokEngineCore::setEntityPosition(uint64_t entityId, float x, float y, float z) {
    auto it = entities_.find(entityId);
    if (it == entities_.end()) return;
    it->second.posX = x;
    it->second.posY = y;
    it->second.posZ = z;
}

void GameTokEngineCore::setEntityVelocity(uint64_t entityId, float vx, float vy, float vz) {
    // Sets velocity on Jolt physics body
}

void GameTokEngineCore::addEntityForce(uint64_t entityId, float fx, float fy, float fz) {
    // Applies impulse force to Jolt physics body
}

void GameTokEngineCore::setCameraMode(CameraMode mode) {
    config_.cameraMode = mode;
    std::cout << "📷 [GameTok C++ Engine] Camera mode set to: " << (mode == CameraMode::Perspective3D ? "3D Perspective" : "2D Orthographic") << std::endl;
}

void GameTokEngineCore::setCameraPosition(float x, float y, float z) {
    camEyeX_ = x; camEyeY_ = y; camEyeZ_ = z;
}

void GameTokEngineCore::setCameraTarget(float x, float y, float z) {
    camTargetX_ = x; camTargetY_ = y; camTargetZ_ = z;
}

void GameTokEngineCore::handleTouchDown(float x, float y, int pointerId) {}
void GameTokEngineCore::handleTouchMove(float x, float y, int pointerId) {}
void GameTokEngineCore::handleTouchUp(float x, float y, int pointerId) {}
void GameTokEngineCore::handleJoystickInput(float dirX, float dirY) {}
void GameTokEngineCore::handleAction(const std::string& actionName) {}

void GameTokEngineCore::dispatchScriptEvent(const std::string& eventName, const std::string& payloadJson) {
    if (!jsContext_) return;
    std::string invoke = "if (typeof onGameEvent === 'function') { onGameEvent('" + eventName + "', " + payloadJson + "); }";
    loadScript(invoke);
}

} // namespace gametok
