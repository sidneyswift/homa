import ExpoModulesCore
import PDFKit
import UIKit

public final class HomaPrintModule: Module {
  public func definition() -> ModuleDefinition {
    Name("HomaPrint")

    AsyncFunction("print") {
      (
        uri: String,
        authorization: String,
        title: String,
        pageIndexes: [Int],
        requestedCopies: Int,
        promise: Promise
      ) in
      Task {
        let downloaded: Data
        do {
          guard let url = URL(string: uri) else {
            promise.resolve(Self.result("failed", "bad-url"))
            return
          }
          var request = URLRequest(url: url)
          request.setValue(authorization, forHTTPHeaderField: "Authorization")
          request.setValue("application/pdf", forHTTPHeaderField: "Accept")
          let (data, response) = try await URLSession.shared.data(for: request)
          guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            promise.resolve(Self.result("failed", "expired-material"))
            return
          }
          guard data.starts(with: Data("%PDF".utf8)) else {
            promise.resolve(Self.result("failed", "invalid-pdf"))
            return
          }
          downloaded = data
        } catch {
          promise.resolve(Self.result("failed", "download-failed"))
          return
        }

        await MainActor.run {
          guard UIApplication.shared.applicationState == .active else {
            promise.resolve(Self.result("failed", "app-backgrounded"))
            return
          }
          guard UIPrintInteractionController.isPrintingAvailable else {
            promise.resolve(Self.result("failed", "printing-unavailable"))
            return
          }
          guard let source = PDFDocument(data: downloaded) else {
            promise.resolve(Self.result("failed", "invalid-pdf"))
            return
          }

          let selected = PDFDocument()
          for (destination, sourceIndex) in pageIndexes.enumerated() {
            guard sourceIndex >= 0, sourceIndex < source.pageCount,
                  let page = source.page(at: sourceIndex)?.copy() as? PDFPage else {
              promise.resolve(Self.result("failed", "invalid-page-range"))
              return
            }
            selected.insert(page, at: destination)
          }
          guard selected.pageCount > 0, let printableData = selected.dataRepresentation() else {
            promise.resolve(Self.result("failed", "empty-document"))
            return
          }

          let controller = UIPrintInteractionController.shared
          let info = UIPrintInfo.printInfo()
          info.outputType = .general
          info.duplex = .none
          info.jobName = requestedCopies > 1
            ? "\(title) · \(requestedCopies) copies requested"
            : title
          controller.printInfo = info
          controller.printingItem = printableData
          controller.showsNumberOfCopies = true

          let presented = controller.present(animated: true) { _, completed, error in
            if error != nil {
              promise.resolve(Self.result("failed", "printer-error"))
            } else if completed {
              promise.resolve(Self.result("completed", nil))
            } else {
              promise.resolve(Self.result("canceled", nil))
            }
          }
          if !presented {
            promise.resolve(Self.result("failed", "sheet-unavailable"))
          }
        }
      }
    }
  }

  private static func result(_ status: String, _ reason: String?) -> [String: Any?] {
    ["status": status, "reason": reason]
  }
}
