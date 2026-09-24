Pod::Spec.new do |s|
  s.name           = 'GameTokEngine'
  s.version        = '1.0.0'
  s.summary        = 'GameTok Custom Native 3D Engine for iOS'
  s.description    = 'Native C++ Engine integrating Google Filament, Jolt Physics, and QuickJS'
  s.author         = 'GameTok'
  s.homepage       = 'https://gametok.co'
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => '' }

  s.dependency 'ExpoModulesCore'

  s.source_files = [
    'ios/**/*.{h,m,mm,swift}',
    'cpp/core/**/*.{h,hpp,cpp}',
    'cpp/vendor/quickjs/**/*.{c,h}',
    'cpp/vendor/jolt/**/*.{h,cpp}'
  ]

  s.public_header_files = 'ios/**/*.h'

  s.frameworks = ['Metal', 'MetalKit', 'QuartzCore', 'UIKit']

  s.pod_target_xcconfig = {
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
    'OTHER_CPLUSPLUSFLAGS' => '-DJPH_PROFILE_ENABLED=0 -DJPH_FLOATING_POINT_EXCEPTIONS_ENABLED=0',
    'HEADER_SEARCH_PATHS' => '"$(PODS_TARGET_SRCROOT)/cpp/vendor/jolt" "$(PODS_TARGET_SRCROOT)/cpp/vendor/quickjs" "$(PODS_TARGET_SRCROOT)/cpp/core"'
  }
end
