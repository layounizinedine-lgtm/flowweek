import Foundation

@MainActor
final class FlowWeekStore: ObservableObject {
    @Published var history: [DictationEntry] = [] {
        didSet { save(history, key: historyKey) }
    }
    @Published var snippets: [Snippet] = [] {
        didSet { save(snippets, key: snippetsKey) }
    }

    private let historyKey = "flowweek.history"
    private let snippetsKey = "flowweek.snippets"
    private let maxHistory = 50
    private let maxTextLength = 12_000

    init() {
        history = load([DictationEntry].self, key: historyKey) ?? []
        snippets = load([Snippet].self, key: snippetsKey) ?? []
    }

    func addHistory(_ text: String) {
        let clean = String(text.prefix(maxTextLength)).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }
        history.insert(DictationEntry(text: clean), at: 0)
        history = Array(history.prefix(maxHistory))
    }

    func addSnippet(key: String, value: String) {
        let cleanKey = String(key.prefix(60)).trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanValue = String(value.prefix(500)).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanKey.isEmpty, !cleanValue.isEmpty, snippets.count < 50 else { return }
        snippets.append(Snippet(key: cleanKey, value: cleanValue))
    }

    func applySnippets(to text: String) -> String {
        snippets.reduce(text) { partial, snippet in
            partial.replacingOccurrences(of: snippet.key, with: snippet.value, options: [.caseInsensitive])
        }
    }

    private func save<T: Encodable>(_ value: T, key: String) {
        guard let data = try? JSONEncoder().encode(value) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }

    private func load<T: Decodable>(_ type: T.Type, key: String) -> T? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }
}

