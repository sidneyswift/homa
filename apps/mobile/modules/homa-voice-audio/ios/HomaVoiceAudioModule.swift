import AVFoundation
import ExpoModulesCore
import WebRTC

public final class HomaVoiceAudioModule: Module {
  public func definition() -> ModuleDefinition {
    Name("HomaVoiceAudio")

    AsyncFunction("prepareForConversation") { (promise: Promise) in
      let configuration = RTCAudioSessionConfiguration.webRTC()
      configuration.category = AVAudioSession.Category.playAndRecord.rawValue
      configuration.mode = AVAudioSession.Mode.voiceChat.rawValue
      configuration.categoryOptions.insert(.defaultToSpeaker)
      configuration.categoryOptions.insert(.allowBluetoothHFP)
      RTCAudioSessionConfiguration.setWebRTC(configuration)
      promise.resolve(Self.routeSnapshot())
    }

    AsyncFunction("currentRoute") { (promise: Promise) in
      promise.resolve(Self.routeSnapshot())
    }
  }

  private static func routeSnapshot() -> [String: Any] {
    let session = AVAudioSession.sharedInstance()
    return [
      "category": session.category.rawValue,
      "mode": session.mode.rawValue,
      "outputVolume": session.outputVolume,
      "outputs": session.currentRoute.outputs.map { $0.portType.rawValue },
    ]
  }
}
