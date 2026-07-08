import Foundation

struct AIClient {
    var endpointString = "https://flowweek-one.vercel.app/api/chat"

    func run(text: String, action: AIAction) async throws -> String {
        let clean = String(text.prefix(12_000)).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return "" }
        guard let endpoint = URL(string: endpointString) else {
            throw FlowWeekAIError.invalidEndpoint
        }

        let requestBody = ChatRequest(
            system: action.systemPrompt,
            messages: [ChatMessage(role: "user", content: clean)],
            maxTokens: 1000
        )

        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(requestBody)
        request.timeoutInterval = 30

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw FlowWeekAIError.invalidResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            throw FlowWeekAIError.backend(status: http.statusCode)
        }
        let decoded = try JSONDecoder().decode(ChatResponse.self, from: data)
        return decoded.text.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

private struct ChatRequest: Encodable {
    let system: String
    let messages: [ChatMessage]
    let maxTokens: Int

    enum CodingKeys: String, CodingKey {
        case system
        case messages
        case maxTokens = "max_tokens"
    }
}

private struct ChatMessage: Codable {
    let role: String
    let content: String
}

private struct ChatResponse: Decodable {
    let text: String
}

enum FlowWeekAIError: LocalizedError {
    case invalidEndpoint
    case invalidResponse
    case backend(status: Int)

    var errorDescription: String? {
        switch self {
        case .invalidEndpoint:
            return "The FlowWeek backend URL is invalid."
        case .invalidResponse:
            return "The AI service returned an invalid response."
        case .backend(let status):
            return "The AI service is unavailable right now. Status: \(status)"
        }
    }
}
