import { Controller } from "@hotwired/stimulus"

// Main analysis workbench controller
export default class extends Controller {
  static targets = [
    "input", "output", "charCount", "submitBtn", "submitText", "spinner",
    "copyBtn", "ragToggle", "pubmedToggle", "ragPanel", "ragResults",
    "pubmedPanel", "pubmedResults"
  ]

  connect() {
    this.csrfToken = document.querySelector("meta[name='csrf-token']")?.content
  }

  updateCharCount() {
    const count = this.inputTarget.value.length
    this.charCountTarget.textContent = `${count} characters`
  }

  uploadComplete({ detail: { content } }) {
    if (content) {
      this.inputTarget.value = content
      this.updateCharCount()
    }
  }

  loadDemo() {
    this.inputTarget.value = `Patient: 68-year-old male with PMH of HTN, DM2, CKD stage 3
Chief Complaint: Progressive dyspnea on exertion x 2 weeks, orthopnea, bilateral lower extremity edema

Vitals: BP 158/94, HR 102, RR 24, SpO2 91% on RA, Temp 37.1C
Exam: JVD to angle of jaw, bibasilar crackles to mid-lung fields, 3+ pitting edema to knees bilaterally, S3 gallop

Labs: BNP 2,840 pg/mL, Troponin I 0.06 ng/mL, Cr 2.1 (baseline 1.4), K 5.2, Na 131
CXR: Bilateral pleural effusions, pulmonary vascular congestion, cardiomegaly
ECG: Sinus tachycardia, LVH, no acute ST changes

Assessment: Acute decompensated heart failure (ADHF) with volume overload
Plan: IV furosemide 40mg bolus then gtt, strict I/O, daily weights, cardiology consult, echo in AM`
    this.updateCharCount()
  }

  async submit() {
    const text = this.inputTarget.value.trim()
    if (!text) return

    this.setLoading(true)

    try {
      const body = { text, use_rag: this.ragToggleTarget.checked }

      // PubMed search if enabled
      if (this.pubmedToggleTarget.checked) {
        await this.fetchPubMed(text)
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": this.csrfToken
        },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (response.ok) {
        this.outputTarget.innerHTML = this.renderMarkdown(data.analysis || data.result)
        this.copyBtnTarget.classList.remove("hidden")
      } else {
        this.outputTarget.innerHTML = `<div class="text-red-400">Error: ${data.error || "Analysis failed"}</div>`
      }
    } catch (error) {
      this.outputTarget.innerHTML = `<div class="text-red-400">Network error: ${error.message}</div>`
    } finally {
      this.setLoading(false)
    }
  }

  async fetchPubMed(text) {
    try {
      const response = await fetch("/api/pubmed/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": this.csrfToken
        },
        body: JSON.stringify({ query: text.substring(0, 200) })
      })

      if (response.ok) {
        const data = await response.json()
        if (data.articles?.length > 0) {
          this.pubmedPanelTarget.classList.remove("hidden")
          this.pubmedResultsTarget.innerHTML = data.articles.map(a =>
            `<div class="p-2 bg-gray-800/50 rounded">
              <p class="text-gray-300 text-xs font-medium">${this.escapeHtml(a.title)}</p>
              <p class="text-gray-500 text-xs mt-1">${this.escapeHtml(a.authors?.join(", ") || "")} (${a.year || ""})</p>
            </div>`
          ).join("")
        }
      }
    } catch {
      // PubMed failure is non-critical
    }
  }

  copyResult() {
    const text = this.outputTarget.innerText
    navigator.clipboard.writeText(text)
    this.copyBtnTarget.textContent = "Copied!"
    setTimeout(() => { this.copyBtnTarget.textContent = "Copy" }, 2000)
  }

  setLoading(loading) {
    this.submitBtnTarget.disabled = loading
    this.spinnerTarget.classList.toggle("hidden", !loading)
    this.submitTextTarget.textContent = loading ? "Analyzing..." : "Analyze Clinical Text"
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

  escapeHtml(text) {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
  }
}
