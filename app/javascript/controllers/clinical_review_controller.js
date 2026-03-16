import { Controller } from "@hotwired/stimulus"

// Multi-turn clinical review chat controller
export default class extends Controller {
  static targets = [
    "input", "messages", "submitBtn", "messageCount",
    "evidenceToggle", "evidencePanel"
  ]

  connect() {
    this.history = []
    this.csrfToken = document.querySelector("meta[name='csrf-token']")?.content
  }

  submitOnEnter(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      this.submit()
    }
  }

  async submit() {
    const text = this.inputTarget.value.trim()
    if (!text) return

    // Add user message to UI
    this.addMessage("user", text)
    this.history.push({ role: "user", content: text })
    this.inputTarget.value = ""
    this.updateCount()

    this.submitBtnTarget.disabled = true

    try {
      const body = { messages: this.history }

      if (this.evidenceToggleTarget.checked) {
        body.include_evidence = true
      }

      const response = await fetch("/api/clinical_review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": this.csrfToken
        },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (response.ok) {
        const reply = data.response || data.result || "No response received"
        this.addMessage("assistant", reply)
        this.history.push({ role: "assistant", content: reply })

        if (data.evidence?.length > 0) {
          this.showEvidence(data.evidence)
        }
      } else {
        this.addMessage("error", data.error || "Request failed")
      }
    } catch (error) {
      this.addMessage("error", `Network error: ${error.message}`)
    } finally {
      this.submitBtnTarget.disabled = false
      this.updateCount()
    }
  }

  addMessage(role, content) {
    // Remove placeholder if present
    const placeholder = this.messagesTarget.querySelector(".text-gray-600")
    if (placeholder) placeholder.parentElement?.remove()

    const wrapper = document.createElement("div")
    wrapper.className = "flex gap-3"

    const colors = {
      user: "bg-blue-600/20 border-blue-500/30",
      assistant: "bg-gray-800 border-gray-700",
      error: "bg-red-900/20 border-red-500/30"
    }

    const labels = { user: "You", assistant: "AI", error: "Error" }

    wrapper.innerHTML = `
      <div class="shrink-0 w-8 h-8 rounded-lg ${colors[role]} border flex items-center justify-center text-xs font-bold">
        ${labels[role]}
      </div>
      <div class="flex-1 ${colors[role]} border rounded-lg p-3 text-sm text-gray-200">
        ${this.formatMessage(content)}
      </div>
    `

    this.messagesTarget.appendChild(wrapper)
    this.messagesTarget.scrollTop = this.messagesTarget.scrollHeight
  }

  showEvidence(evidence) {
    this.evidencePanelTarget.innerHTML = evidence.map(e =>
      `<div class="p-2 bg-gray-800/50 rounded text-gray-400">
        <p class="font-medium text-xs">${this.escapeHtml(e.title || "")}</p>
        <p class="text-xs mt-0.5">${this.escapeHtml(e.snippet || "")}</p>
      </div>`
    ).join("")
  }

  clearHistory() {
    this.history = []
    this.messagesTarget.innerHTML = `
      <div class="flex items-center justify-center h-full text-gray-600 text-sm">
        <p class="text-center">
          Start a clinical consultation.<br>
          <span class="text-xs">Ask questions about clinical scenarios, differential diagnoses, or treatment plans.</span>
        </p>
      </div>`
    this.updateCount()
  }

  updateCount() {
    const userMessages = this.history.filter(m => m.role === "user").length
    this.messageCountTarget.textContent = userMessages
  }

  formatMessage(text) {
    return text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/\n/g, "<br>")
  }

  escapeHtml(text) {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
  }
}
