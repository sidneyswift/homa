Pod::Spec.new do |s|
  s.name           = 'HomaVoiceAudio'
  s.version        = '1.0.0'
  s.summary        = 'Native WebRTC speaker routing for Homa voice'
  s.description    = 'Configures WebRTC voice calls to use the loudspeaker by default while preserving connected audio accessories.'
  s.license        = { :type => 'MIT' }
  s.author         = { 'Homa' => 'hello@thankshoma.com' }
  s.homepage       = 'https://thankshoma.com'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.dependency 'JitsiWebRTC', '~> 124.0'
  s.frameworks = 'AVFoundation'
  s.source_files = '**/*.{h,m,mm,swift}'
end
