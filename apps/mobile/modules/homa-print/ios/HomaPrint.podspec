Pod::Spec.new do |s|
  s.name           = 'HomaPrint'
  s.version        = '1.0.0'
  s.summary        = 'Truthful native printing for Homa materials'
  s.description    = 'Downloads an authenticated PDF and presents the iOS print controller.'
  s.license        = { :type => 'MIT' }
  s.author         = { 'Homa' => 'hello@thankshoma.com' }
  s.homepage       = 'https://thankshoma.com'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'UIKit', 'PDFKit'
  s.source_files = '**/*.{h,m,mm,swift}'
end
