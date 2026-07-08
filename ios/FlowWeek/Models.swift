import Foundation

struct DictationEntry: Identifiable, Codable, Equatable {
    let id: UUID
    var text: String
    var createdAt: Date

    init(id: UUID = UUID(), text: String, createdAt: Date = Date()) {
        self.id = id
        self.text = text
        self.createdAt = createdAt
    }
}

struct Snippet: Identifiable, Codable, Equatable {
    let id: UUID
    var key: String
    var value: String

    init(id: UUID = UUID(), key: String, value: String) {
        self.id = id
        self.key = key
        self.value = value
    }
}

enum AIAction: String, CaseIterable, Identifiable {
    case polish = "Polish"
    case summarize = "Summarize"
    case bullets = "Bullets"
    case formal = "Formal"
    case translateEnglish = "English"

    var id: String { rawValue }

    var systemPrompt: String {
        switch self {
        case .polish:
            return "You polish raw dictation. Remove filler words, fix punctuation and casing, preserve the original language and meaning. Return only the polished text."
        case .summarize:
            return "Summarize the text clearly and briefly. Return only the summary."
        case .bullets:
            return "Convert the text into clear bullet points. Return only the bullet list."
        case .formal:
            return "Rewrite the text in a clear, professional tone. Preserve the meaning. Return only the rewritten text."
        case .translateEnglish:
            return "Translate the text into natural English. Return only the translation."
        }
    }
}

