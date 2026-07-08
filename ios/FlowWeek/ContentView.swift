import SwiftUI
import UIKit

struct ContentView: View {
    @StateObject private var speech = SpeechRecognizer()
    @StateObject private var store = FlowWeekStore()
    @State private var text = ""
    @State private var snippetKey = ""
    @State private var snippetValue = ""
    @State private var isWorking = false
    @State private var errorMessage: String?
    @State private var isShowingShare = false

    private let aiClient = AIClient()

    var body: some View {
        NavigationStack {
            List {
                Section {
                    TextEditor(text: $text)
                        .frame(minHeight: 180)
                        .textInputAutocapitalization(.sentences)
                        .autocorrectionDisabled(false)

                    HStack {
                        Button {
                            toggleRecording()
                        } label: {
                            Label(speech.isRecording ? "Stop" : "Diktieren", systemImage: speech.isRecording ? "stop.fill" : "mic.fill")
                        }
                        .buttonStyle(.borderedProminent)

                        Button {
                            copyText()
                        } label: {
                            Label("Kopieren", systemImage: "doc.on.doc")
                        }
                        .buttonStyle(.bordered)
                        .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                        Button {
                            isShowingShare = true
                        } label: {
                            Label("Teilen", systemImage: "square.and.arrow.up")
                        }
                        .buttonStyle(.bordered)
                        .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                } header: {
                    Text("Diktat")
                }

                Section("KI") {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 130), spacing: 10)], spacing: 10) {
                        ForEach(AIAction.allCases) { action in
                            Button(action.rawValue) {
                                runAI(action)
                            }
                            .buttonStyle(.bordered)
                            .disabled(isWorking || text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        }
                    }
                    if isWorking {
                        ProgressView("KI arbeitet")
                    }
                }

                Section("Snippets") {
                    HStack {
                        TextField("Kuerzel", text: $snippetKey)
                        TextField("Volltext", text: $snippetValue)
                        Button {
                            store.addSnippet(key: snippetKey, value: snippetValue)
                            snippetKey = ""
                            snippetValue = ""
                        } label: {
                            Image(systemName: "plus")
                        }
                    }

                    ForEach(store.snippets) { snippet in
                        VStack(alignment: .leading) {
                            Text(snippet.key).font(.headline)
                            Text(snippet.value).foregroundStyle(.secondary)
                        }
                    }
                }

                Section("Verlauf") {
                    ForEach(store.history) { entry in
                        Button {
                            text = entry.text
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(entry.createdAt, style: .date)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Text(entry.text)
                                    .lineLimit(3)
                            }
                        }
                    }
                }
            }
            .navigationTitle("FlowWeek")
            .toolbar {
                Button {
                    text = ""
                } label: {
                    Image(systemName: "trash")
                }
                .disabled(text.isEmpty)
            }
            .task {
                await speech.requestAuthorization()
            }
            .onChange(of: speech.transcript) { _, newValue in
                text = store.applySnippets(to: newValue)
            }
            .alert("FlowWeek", isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
            .sheet(isPresented: $isShowingShare) {
                ShareSheet(items: [text])
            }
        }
    }

    private func toggleRecording() {
        do {
            if speech.isRecording {
                speech.stop()
                store.addHistory(text)
            } else {
                try speech.start()
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func copyText() {
        UIPasteboard.general.string = text
        store.addHistory(text)
    }

    private func runAI(_ action: AIAction) {
        isWorking = true
        Task {
            do {
                let result = try await aiClient.run(text: text, action: action)
                await MainActor.run {
                    text = result
                    store.addHistory(result)
                    isWorking = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isWorking = false
                }
            }
        }
    }
}

#Preview {
    ContentView()
}

