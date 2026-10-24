const { withAppDelegate } = require('@expo/config-plugins');

const IMPORT_LINE = 'import AVFoundation';
const SETUP_LINE = '    configureForegroundAudioSession()\n    observeAudioLifecycle()';
const LEGACY_SETUP_ANCHOR = '    bindReactNativeFactory(factory)';
const SCENE_SETUP_ANCHOR = '    reactNativeFactory = factory';
const METHODS = `

  private func observeAudioLifecycle() {
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(deactivateGameAudioSession),
      name: UIApplication.willResignActiveNotification,
      object: nil)
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(deactivateGameAudioSession),
      name: UIApplication.didEnterBackgroundNotification,
      object: nil)
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(activateGameAudioSession),
      name: UIApplication.didBecomeActiveNotification,
      object: nil)
  }

  private func configureForegroundAudioSession() {
    do {
      try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
      try AVAudioSession.sharedInstance().setActive(true)
    } catch {
      NSLog("[GameTOK] Failed to configure foreground audio session: \\(error)")
    }
  }

  @objc private func activateGameAudioSession() {
    configureForegroundAudioSession()
  }

  @objc private func deactivateGameAudioSession() {
    do {
      try AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
    } catch {
      NSLog("[GameTOK] Failed to deactivate audio session: \\(error)")
    }
  }
`;

function applyAudioSessionPatch(contents) {
  let next = contents;

  if (!next.includes(IMPORT_LINE)) {
    next = next.replace('import ReactAppDependencyProvider', `import ReactAppDependencyProvider\n${IMPORT_LINE}`);
  }

  if (!next.includes('observeAudioLifecycle()')) {
    const anchor = next.includes(LEGACY_SETUP_ANCHOR)
      ? LEGACY_SETUP_ANCHOR
      : SCENE_SETUP_ANCHOR;
    next = next.replace(anchor, `${anchor}\n${SETUP_LINE}`);
  }

  if (!next.includes('deactivateGameAudioSession')) {
    const delegateEnd = '\n}\n\nclass ReactNativeDelegate';
    next = next.replace(delegateEnd, `${METHODS}\n}\n\nclass ReactNativeDelegate`);
  }

  return next;
}

module.exports = function withIosAudioSession(config) {
  return withAppDelegate(config, config => {
    if (config.modResults.language === 'swift') {
      config.modResults.contents = applyAudioSessionPatch(config.modResults.contents);
    }
    return config;
  });
};
