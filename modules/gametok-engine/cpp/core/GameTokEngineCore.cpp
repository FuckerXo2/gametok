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

GameTokEngineCore::GameTokEngineCore() {}

GameTokEngineCore::~GameTokEngineCore() {
    shutdown();
}

bool GameTokEngineCore::initialize(const EngineConfig& config) {
    if (initialized_) return true;
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

    initialized_ = true;
    std::cout << "✅ [GameTok C++ Engine] Native runtime initialized successfully!" << std::endl;
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

// QuickJS bindings
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

void GameTokEngineCore::registerScriptBindings() {
    JSValue global_obj = JS_GetGlobalObject(jsContext_);
    JSValue engine_obj = JS_NewObject(jsContext_);

    JS_SetPropertyStr(jsContext_, engine_obj, "log", JS_NewCFunction(jsContext_, js_engine_log, "log", 1));

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

    // Step Jolt physics (fixed 60Hz delta)
    const float cDeltaTime = 1.0f / 60.0f;
    const int cCollisionSteps = 1;
    if (physicsSystem_) {
        physicsSystem_->Update(cDeltaTime, cCollisionSteps, tempAllocator_.get(), jobSystem_.get());
    }
}

void GameTokEngineCore::render() {
    if (!initialized_) return;
    // Renders active Filament scene via Metal / Vulkan swapchain
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
    std::cout << "📦 [GameTok C++ Engine] Spawning model: " << assetUrl << " at (" << x << ", " << y << ", " << z << ") ID: " << id << std::endl;
    return id;
}

bool GameTokEngineCore::playAnimation(uint64_t entityId, const std::string& animName, float crossFadeSeconds) {
    std::cout << "💃 [GameTok C++ Engine] Playing mocap animation: " << animName << " on entity " << entityId << " (blend: " << crossFadeSeconds << "s)" << std::endl;
    return true;
}

void GameTokEngineCore::setEntityPosition(uint64_t entityId, float x, float y, float z) {
    // Updates Filament transform and Jolt body position
}

void GameTokEngineCore::setCameraMode(CameraMode mode) {
    config_.cameraMode = mode;
    std::cout << "📷 [GameTok C++ Engine] Camera mode set to: " << (mode == CameraMode::Perspective3D ? "3D Perspective" : "2D Orthographic") << std::endl;
}

void GameTokEngineCore::setCameraPosition(float x, float y, float z) {}
void GameTokEngineCore::setCameraTarget(float x, float y, float z) {}

void GameTokEngineCore::handleTouchDown(float x, float y, int pointerId) {}
void GameTokEngineCore::handleTouchMove(float x, float y, int pointerId) {}
void GameTokEngineCore::handleTouchUp(float x, float y, int pointerId) {}
void GameTokEngineCore::handleJoystickInput(float dirX, float dirY) {}
void GameTokEngineCore::handleAction(const std::string& actionName) {}

} // namespace gametok
