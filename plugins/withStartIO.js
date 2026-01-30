const { withXcodeProject, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Swift file content
const swiftFileContent = `// StartIOAdsModule.swift
// Native module to bridge Start.io SDK to React Native

import Foundation
import React
import StartApp

@objc(StartIOAdsModule)
class StartIOAdsModule: RCTEventEmitter, STADelegateProtocol {
  
  private var interstitialAd: STAStartAppAd?
  private var rewardedAd: STAStartAppAd?
  private var isInitialized = false
  private var interstitialLoaded = false
  private var rewardedLoaded = false
  
  private var loadInterstitialResolve: RCTPromiseResolveBlock?
  private var loadInterstitialReject: RCTPromiseRejectBlock?
  private var showInterstitialResolve: RCTPromiseResolveBlock?
  private var showInterstitialReject: RCTPromiseRejectBlock?
  private var loadRewardedResolve: RCTPromiseResolveBlock?
  private var loadRewardedReject: RCTPromiseRejectBlock?
  private var showRewardedResolve: RCTPromiseResolveBlock?
  private var showRewardedReject: RCTPromiseRejectBlock?
  
  override init() {
    super.init()
  }
  
  @objc override static func requiresMainQueueSetup() -> Bool {
    return true
  }
  
  override func supportedEvents() -> [String]! {
    return ["onAdLoaded", "onAdLoadFailed", "onAdShown", "onAdClosed", "onAdClicked", "onRewardEarned"]
  }
  
  @objc func initialize(_ appId: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      let sdk = STAStartAppSDK.sharedInstance()
      sdk?.appID = appId
      sdk?.returnAdEnabled = false
      self.isInitialized = true
      print("[StartIO] SDK initialized with appId: \\(appId)")
      resolve(true)
    }
  }
  
  @objc func setUserConsent(_ consent: Bool) {
    DispatchQueue.main.async {
      let timestamp = Int(Date().timeIntervalSince1970)
      STAStartAppSDK.sharedInstance()?.setUserConsent(consent, forConsentType: "pas", withTimestamp: timestamp)
      print("[StartIO] User consent set to: \\(consent)")
    }
  }
  
  @objc func loadInterstitial(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard isInitialized else {
      reject("NOT_INITIALIZED", "Start.io SDK not initialized", nil)
      return
    }
    DispatchQueue.main.async {
      self.loadInterstitialResolve = resolve
      self.loadInterstitialReject = reject
      self.interstitialAd = STAStartAppAd()
      // Use loadAd with ad type and delegate - the correct API for interstitials with callbacks
      self.interstitialAd?.load(STAAdType_Automatic, withDelegate: self)
      print("[StartIO] Loading interstitial ad...")
    }
  }
  
  @objc func showInterstitial(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard isInitialized else {
      reject("NOT_INITIALIZED", "Start.io SDK not initialized", nil)
      return
    }
    guard interstitialLoaded, let ad = interstitialAd else {
      reject("AD_NOT_LOADED", "Interstitial ad not loaded", nil)
      return
    }
    DispatchQueue.main.async {
      self.showInterstitialResolve = resolve
      self.showInterstitialReject = reject
      ad.show()
      print("[StartIO] Showing interstitial ad...")
    }
  }
  
  @objc func loadRewardedVideo(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard isInitialized else {
      reject("NOT_INITIALIZED", "Start.io SDK not initialized", nil)
      return
    }
    DispatchQueue.main.async {
      self.loadRewardedResolve = resolve
      self.loadRewardedReject = reject
      self.rewardedAd = STAStartAppAd()
      self.rewardedAd?.loadRewardedVideoAd(withDelegate: self)
      print("[StartIO] Loading rewarded video ad...")
    }
  }
  
  @objc func showRewardedVideo(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard isInitialized else {
      reject("NOT_INITIALIZED", "Start.io SDK not initialized", nil)
      return
    }
    guard rewardedLoaded, let ad = rewardedAd else {
      reject("AD_NOT_LOADED", "Rewarded video ad not loaded", nil)
      return
    }
    DispatchQueue.main.async {
      self.showRewardedResolve = resolve
      self.showRewardedReject = reject
      ad.show()
      print("[StartIO] Showing rewarded video ad...")
    }
  }
  
  // MARK: - STADelegateProtocol methods
  
  func didLoadAd(_ ad: STAAbstractAd!) {
    print("[StartIO] Ad loaded successfully")
    if ad === interstitialAd {
      interstitialLoaded = true
      loadInterstitialResolve?(true)
      loadInterstitialResolve = nil
      loadInterstitialReject = nil
      sendEvent(withName: "onAdLoaded", body: ["type": "interstitial"])
    } else if ad === rewardedAd {
      rewardedLoaded = true
      loadRewardedResolve?(true)
      loadRewardedResolve = nil
      loadRewardedReject = nil
      sendEvent(withName: "onAdLoaded", body: ["type": "rewarded"])
    }
  }
  
  func failedLoadAd(_ ad: STAAbstractAd!, withError error: Error!) {
    let errorMessage = error?.localizedDescription ?? "Unknown error"
    print("[StartIO] Ad failed to load: \\(errorMessage)")
    if ad === interstitialAd {
      interstitialLoaded = false
      loadInterstitialReject?("LOAD_FAILED", errorMessage, error)
      loadInterstitialResolve = nil
      loadInterstitialReject = nil
      sendEvent(withName: "onAdLoadFailed", body: ["type": "interstitial", "error": errorMessage])
    } else if ad === rewardedAd {
      rewardedLoaded = false
      loadRewardedReject?("LOAD_FAILED", errorMessage, error)
      loadRewardedResolve = nil
      loadRewardedReject = nil
      sendEvent(withName: "onAdLoadFailed", body: ["type": "rewarded", "error": errorMessage])
    }
  }
  
  func didShowAd(_ ad: STAAbstractAd!) {
    print("[StartIO] Ad shown")
    sendEvent(withName: "onAdShown", body: nil)
  }
  
  func failedShowAd(_ ad: STAAbstractAd!, withError error: Error!) {
    print("[StartIO] Ad failed to show: \\(error?.localizedDescription ?? "Unknown error")")
    if ad === interstitialAd {
      showInterstitialReject?("SHOW_FAILED", error?.localizedDescription ?? "Unknown error", error)
      showInterstitialResolve = nil
      showInterstitialReject = nil
    } else if ad === rewardedAd {
      showRewardedReject?("SHOW_FAILED", error?.localizedDescription ?? "Unknown error", error)
      showRewardedResolve = nil
      showRewardedReject = nil
    }
  }
  
  func didCloseAd(_ ad: STAAbstractAd!) {
    print("[StartIO] Ad closed")
    if ad === interstitialAd {
      interstitialLoaded = false
      showInterstitialResolve?(true)
      showInterstitialResolve = nil
      showInterstitialReject = nil
    } else if ad === rewardedAd {
      rewardedLoaded = false
      showRewardedResolve?(true)
      showRewardedResolve = nil
      showRewardedReject = nil
    }
    sendEvent(withName: "onAdClosed", body: nil)
  }
  
  func didClickAd(_ ad: STAAbstractAd!) {
    print("[StartIO] Ad clicked")
    sendEvent(withName: "onAdClicked", body: nil)
  }
  
  func didCompleteVideo(_ ad: STAAbstractAd!) {
    print("[StartIO] Rewarded video completed - user earned reward")
    sendEvent(withName: "onRewardEarned", body: nil)
  }
}
`;

// Objective-C file content
const objcFileContent = `// StartIOAdsModule.m
// Native module to bridge Start.io SDK to React Native

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(StartIOAdsModule, RCTEventEmitter)

RCT_EXTERN_METHOD(initialize:(NSString *)appId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(loadInterstitial:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(showInterstitial:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(loadRewardedVideo:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(showRewardedVideo:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setUserConsent:(BOOL)consent)

@end
`;

const withStartIOFiles = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const iosPath = path.join(projectRoot, 'ios', 'GameTOK');
      
      // Write Swift file
      const swiftPath = path.join(iosPath, 'StartIOAdsModule.swift');
      fs.writeFileSync(swiftPath, swiftFileContent);
      console.log('[StartIO Plugin] Created StartIOAdsModule.swift');
      
      // Write Objective-C file
      const objcPath = path.join(iosPath, 'StartIOAdsModule.m');
      fs.writeFileSync(objcPath, objcFileContent);
      console.log('[StartIO Plugin] Created StartIOAdsModule.m');
      
      // Update bridging header
      const bridgingHeaderPath = path.join(iosPath, 'GameTOK-Bridging-Header.h');
      const bridgingContent = `//
// Use this file to import your target's public headers that you would like to expose to Swift.
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
`;
      fs.writeFileSync(bridgingHeaderPath, bridgingContent);
      console.log('[StartIO Plugin] Updated bridging header');
      
      return config;
    },
  ]);
};

const withStartIOPodfile = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const podfilePath = path.join(projectRoot, 'ios', 'Podfile');
      
      let podfileContent = fs.readFileSync(podfilePath, 'utf8');
      
      // Add StartAppSDK pod if not already present
      if (!podfileContent.includes("pod 'StartAppSDK'")) {
        podfileContent = podfileContent.replace(
          "target 'GameTOK' do\n  use_expo_modules!",
          "target 'GameTOK' do\n  use_expo_modules!\n  \n  # Start.io Ads SDK\n  pod 'StartAppSDK'"
        );
        fs.writeFileSync(podfilePath, podfileContent);
        console.log('[StartIO Plugin] Added StartAppSDK to Podfile');
      }
      
      return config;
    },
  ]);
};

const withStartIOXcodeProject = (config) => {
  return withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const targetName = 'GameTOK';
    
    // Find the main group
    const mainGroup = xcodeProject.getFirstProject().firstProject.mainGroup;
    
    // Add files to the project
    const swiftFile = 'StartIOAdsModule.swift';
    const objcFile = 'StartIOAdsModule.m';
    
    // Get the target
    const target = xcodeProject.getFirstTarget().uuid;
    
    // Add Swift file
    xcodeProject.addSourceFile(
      `GameTOK/${swiftFile}`,
      { target },
      mainGroup
    );
    console.log('[StartIO Plugin] Added StartIOAdsModule.swift to Xcode project');
    
    // Add Objective-C file
    xcodeProject.addSourceFile(
      `GameTOK/${objcFile}`,
      { target },
      mainGroup
    );
    console.log('[StartIO Plugin] Added StartIOAdsModule.m to Xcode project');
    
    return config;
  });
};

module.exports = (config) => {
  config = withStartIOFiles(config);
  config = withStartIOPodfile(config);
  config = withStartIOXcodeProject(config);
  return config;
};
