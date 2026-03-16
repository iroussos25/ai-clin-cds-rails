import { Controller } from "@hotwired/stimulus"

// Recruiter kit demo controller
export default class extends Controller {
  static targets = [
    "preview", "previewTitle", "previewContent", "analyzeBtn",
    "result", "resultContent"
  ]

  connect() {
    this.kits = JSON.parse(document.querySelector("[data-recruiter-kits]")?.dataset.recruiterKits || "[]")
    this.csrfToken = document.querySelector("meta[name='csrf-token']")?.content
    this.currentKit = null
  }

  loadKit({ params: { index } }) {
    // Fetch kit data from the server-rendered data attribute
    this.currentKit = this.kits[index]
    if (!this.currentKit) return

    this.previewTitleTarget.textContent = this.currentKit.title
    this.previewContentTarget.textContent = this.currentKit.clinical_text
    this.previewTarget.classList.remove("hidden")
    this.resultTarget.classList.add("hidden")
  }

  async analyzeKit() {
    if (!this.currentKit) return

    this.analyzeBtnTarget.disabled = true
    this.analyzeBtnTarget.textContent = "Analyzing..."
    this.resultTarget.classList.remove("hidden")
    this.resultContentTarget.innerHTML = '<p class="text-gray-500 animate-pulse">Analyzing clinical text...</p>'

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": this.csrfToken
        },
        body: JSON.stringify({ text: this.currentKit.clinical_text })
      })

      const data = await response.json()

      if (response.ok) {
        this.resultContentTarget.innerHTML = this.renderMarkdown(data.analysis || data.result)
      } else {
        this.resultContentTarget.innerHTML = `<p class="text-red-400">Error: ${data.error || "Analysis failed"}</p>`
      }
    } catch (error) {
      this.resultContentTarget.innerHTML = `<p class="text-red-400">Network error: ${error.message}</p>`
    } finally {
      this.analyzeBtnTarget.disabled = false
      this.analyzeBtnTarget.textContent = "Analyze with AI"
    }
  }

  closePreview() {
    this.previewTarget.classList.add("hidden")
    this.currentKit = null
  }

  renderMarkdown(text) {
    if (!text) return ""
    return text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-white mt-4 mb-2">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-white mt-4 mb-2">$1</h2>')
      .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
      .replace(/\n\n/g, "</p><p class='mt-2'>")
      .replace(/\n/g, "<br>")
  }
}
