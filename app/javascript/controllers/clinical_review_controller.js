import { Controller } from "@hotwired/stimulus"

// Multi-turn clinical review chat controller
export default class extends Controller {
  static targets = [
    "input", "messages", "submitBtn", "submitText", "submitSpinner", "activityIndicator", "messageCount",
    "evidencePanel", "noteEvidencePanel", "literatureQuery", "importPanel", "importSource",
    "importAnalysis", "traceContent", "suggestions", "suggestionsTitle"
  ]

  connect() {
    this.history = []
    this.csrfToken = document.querySelector("meta[name='csrf-token']")?.content
    this.tracePlaybackTimer = null
    this.handleHandoff = this.handleHandoff.bind(this)
    window.addEventListener("clinical-review:handoff", this.handleHandoff)
    this.renderTrace([])
    this.showEvidence([])
    this.showNoteEvidence([])
    this.literatureQueryTarget.textContent = "PubMed query generated automatically from the latest review question."
    this.renderSuggestions()
  }

  disconnect() {
    this.stopTracePlayback()
    window.removeEventListener("clinical-review:handoff", this.handleHandoff)
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
    this.setLoading(true)
    this.startTracePlayback([
      {
        title: "Conversation prep",
        detail: `Packaging ${this.history.length} message(s) for the next clinical review turn.`
      },
      {
        title: "Evidence review",
        detail: "Retrieving PubMed evidence and indexed note support for the latest clinical question."
      },
      {
        title: "Model synthesis",
        detail: "Generating a structured clinical review response."
      }
    ])

    try {
      const body = { messages: this.history }

      if (this.importedContext) {
        body.imported_context = {
          source_text: this.importedContext.sourceText,
          analysis: this.importedContext.analysis,
          model: this.importedContext.model
        }
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
        } else {
          this.showEvidence([])
        }

        this.showNoteEvidence(data.note_evidence || [])
        this.literatureQueryTarget.textContent = data.literature_query || "PubMed query generated automatically from the latest review question."

        this.renderTrace(data.trace || [])
      } else {
        this.renderTrace([
          {
            title: "Clinical review failed",
            detail: data.error || "The clinical review request did not complete successfully.",
            status: "error"
          }
        ])
        this.addMessage("error", data.error || "Request failed")
      }
    } catch (error) {
      this.renderTrace([
        {
          title: "Network error",
          detail: error.message,
          status: "error"
        }
      ])
      this.addMessage("error", `Network error: ${error.message}`)
    } finally {
      this.stopTracePlayback()
      this.setLoading(false)
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
    if (!evidence.length) {
      this.evidencePanelTarget.innerHTML = `<p class="text-xs text-gray-500">No PubMed evidence snippets were retrieved for the latest question.</p>`
      return
    }

    this.evidencePanelTarget.innerHTML = evidence.map(e =>
      `<details class="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 text-gray-300">
        <summary class="cursor-pointer text-xs font-medium text-violet-200">[${this.escapeHtml(e.id || "P?")}] ${this.escapeHtml(e.title || "Untitled literature reference")}</summary>
        <div class="mt-3 space-y-2 text-xs text-gray-400">
          <p>${this.escapeHtml(e.journal || "Unknown journal")}${e.published_at ? ` | ${this.escapeHtml(e.published_at)}` : ""}</p>
          <p class="whitespace-pre-wrap">${this.escapeHtml(e.snippet || "")}</p>
          <div class="flex flex-wrap gap-2">
            <a href="${this.escapeHtml(e.source_url || "#")}" target="_blank" rel="noreferrer" class="rounded border border-violet-400/30 px-2 py-1 text-[11px] text-violet-200 hover:bg-violet-500/10">PubMed</a>
            ${e.pmc_url ? `<a href="${this.escapeHtml(e.pmc_url)}" target="_blank" rel="noreferrer" class="rounded border border-violet-400/30 px-2 py-1 text-[11px] text-violet-200 hover:bg-violet-500/10">PMC</a>` : ""}
          </div>
        </div>
      </details>`
    ).join("")
  }

  showNoteEvidence(evidence) {
    if (!evidence.length) {
      this.noteEvidencePanelTarget.innerHTML = `<p class="text-xs text-gray-500">No indexed note evidence passages were retrieved for the latest question.</p>`
      return
    }

    this.noteEvidencePanelTarget.innerHTML = evidence.map(e => `
      <details class="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-gray-300">
        <summary class="cursor-pointer text-xs font-medium text-cyan-200">[${this.escapeHtml(e.id || "N?")}] Chunk ${e.chunk_index ?? "?"} | score ${(e.similarity || 0).toFixed(3)}</summary>
        <p class="mt-3 whitespace-pre-wrap text-xs text-gray-400">${this.escapeHtml(e.content || "")}</p>
      </details>
    `).join("")
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
    this.evidencePanelTarget.innerHTML = ""
    this.noteEvidencePanelTarget.innerHTML = ""
    this.literatureQueryTarget.textContent = "PubMed query generated automatically from the latest review question."
    this.renderTrace([])
    this.updateCount()
  }

  updateCount() {
    const userMessages = this.history.filter(m => m.role === "user").length
    this.messageCountTarget.textContent = userMessages
  }

  handleHandoff(event) {
    this.setImportedContext(event.detail)
  }

  setImportedContext(payload) {
    if (!payload?.sourceText || !payload?.analysis) return

    this.importedContext = payload
    this.importPanelTarget.classList.remove("hidden")
    this.importSourceTarget.textContent = this.previewText(payload.sourceText, 420)
    this.importAnalysisTarget.textContent = this.previewText(payload.analysis, 420)
    this.renderTrace(payload.trace || [])
    this.renderSuggestions()
  }

  resetPanel() {
    this.stopTracePlayback()
    this.setLoading(false)
    this.importedContext = null
    this.importPanelTarget.classList.add("hidden")
    this.importSourceTarget.textContent = ""
    this.importAnalysisTarget.textContent = ""
    this.inputTarget.value = ""
    this.clearHistory()
    this.renderSuggestions()
  }

  setLoading(loading) {
    this.submitBtnTarget.disabled = loading
    this.submitSpinnerTarget.classList.toggle("hidden", !loading)
    this.activityIndicatorTarget.classList.toggle("hidden", !loading)
    this.submitTextTarget.textContent = loading ? "Reviewing..." : "Run Clinical Review"
  }

  useSuggestion(event) {
    const prompt = event.params.prompt
    if (!prompt) return

    this.inputTarget.value = prompt
    this.inputTarget.focus()
    this.submit()
  }

  renderSuggestions() {
    const suggestions = this.suggestionSet()
    const title = this.importedContext ? "Suggested questions based on the imported case" : "Suggested questions to explore the value of Clinical Review"
    this.suggestionsTitleTarget.textContent = title
    this.suggestionsTarget.innerHTML = suggestions.map(suggestion => `
      <button
        type="button"
        data-action="click->clinical-review#useSuggestion"
        data-clinical-review-prompt-param="${this.escapeAttribute(suggestion.prompt)}"
        class="rounded-full border border-gray-700 bg-gray-800/80 px-3 py-2 text-left text-sm text-gray-200 transition-colors hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-100">
        ${this.escapeHtml(suggestion.label)}
      </button>
    `).join("")
  }

  suggestionSet() {
    if (this.importedContext) {
      const lowered = `${this.importedContext.sourceText || ""}\n${this.importedContext.analysis || ""}`.toLowerCase()
      const suggestions = [
        {
          label: "What do the trends indicate?",
          prompt: "Review the imported note and prior analysis. What do the overall trends indicate, and which findings matter most?"
        },
        {
          label: "Potential diagnosis to consider",
          prompt: "Based only on the imported note and prior analysis, what diagnoses or clinical concerns should be considered, and what supports each one?"
        },
        {
          label: "Next clinical steps to consider",
          prompt: "What possible next clinical considerations or workup steps are reasonable to consider based on the imported note, and what uncertainties remain?"
        },
        {
          label: "What data is missing?",
          prompt: "What important information is missing, incomplete, or ambiguous in the imported case, and how does that limit confidence?"
        }
      ]

      if (/(sepsis|lactate|hypotension|map|vasopressor|wbc|fever|cultures?)/.test(lowered)) {
        suggestions.push({
          label: "Possible sepsis picture",
          prompt: "Do these findings look consistent with an evolving sepsis picture, and what evidence supports or weakens that concern?"
        })
      }

      if (/(creatinine|oliguria|urine output|crrt|bun|dialysis|aki|renal)/.test(lowered)) {
        suggestions.push({
          label: "Renal trends and kidney risk",
          prompt: "What do the renal trends suggest, and what unresolved kidney risks remain?"
        })
      }

      if (/(peep|fio2|ards|ventilator|intubat|oxygen|pao2|trach|respirat)/.test(lowered)) {
        suggestions.push({
          label: "Respiratory trajectory",
          prompt: "Do the respiratory trends suggest worsening failure, recovery, or both?"
        })
      }

      if (/(ecmo|cardiogenic|shock|dobutamine|norepinephrine|vasopressin|pressors?|hemodynamic)/.test(lowered)) {
        suggestions.push({
          label: "Shock severity and recovery",
          prompt: "What does the hemodynamic course suggest about shock severity, likely drivers, and recovery?"
        })
      }

      if (/(delirium|encephalopathy|stroke|neurologic|mental status|confusion)/.test(lowered)) {
        suggestions.push({
          label: "Neurologic concerns",
          prompt: "What neurologic or cognitive concerns are suggested here, and what information would help distinguish between the likely explanations?"
        })
      }

      if (/(gi bleed|melena|hematemesis|transfusion|hemoglobin|bleed)/.test(lowered)) {
        suggestions.push({
          label: "Bleeding risk and significance",
          prompt: "How concerning is the bleeding picture in this case, and what details would a clinician want clarified next?"
        })
      }

      suggestions.push({
        label: "Explain for a non-clinician",
        prompt: "Explain the imported case in plain English for a non-clinician. What seems to be happening, why it matters, and what questions a clinician would likely want answered next?"
      })

      return suggestions.filter((suggestion, index, array) => array.findIndex(item => item.label === suggestion.label) === index).slice(0, 6)
    }

    return [
      {
        label: "What is this panel useful for?",
        prompt: "Explain what Clinical Review does and how it differs from a simple summary tool, in plain English for a non-clinician."
      },
      {
        label: "Show a clinician-style review",
        prompt: "Demonstrate a structured clinician-style review of a case, including trends, concerns, missing data, and possible next considerations."
      },
      {
        label: "Explain the value of evidence synthesis",
        prompt: "Explain why combining a source note, prior analysis, and optional PubMed evidence can be useful in a clinical review workflow."
      },
      {
        label: "What should a non-clinician notice?",
        prompt: "If a non-clinician were evaluating a clinical AI portfolio demo, what signals would show that this panel is genuinely useful and responsibly designed?"
      }
    ]
  }

  renderTrace(trace) {
    if (!trace.length) {
      this.traceContentTarget.innerHTML = `<p class="text-sm text-gray-500">Start a consultation to view the processing trace. This panel shows workflow and retrieval steps only, not hidden model reasoning.</p>`
      return
    }

    this.traceContentTarget.innerHTML = trace.map(step => `
      <div class="rounded-lg border ${this.traceTone(step.status).border} ${this.traceTone(step.status).bg} p-3">
        <div class="flex items-center gap-2">
          <span class="inline-block h-2.5 w-2.5 rounded-full ${this.traceTone(step.status).dot}"></span>
          <p class="text-sm font-semibold ${this.traceTone(step.status).title}">${this.escapeHtml(step.title || "Step")}</p>
        </div>
        <p class="mt-1 text-sm ${this.traceTone(step.status).detail}">${this.escapeHtml(step.detail || "")}</p>
      </div>
    `).join("")
  }

  startTracePlayback(steps) {
    this.stopTracePlayback()
    let activeIndex = 0
    this.renderTrace(steps.map((step, index) => ({ ...step, status: index === 0 ? "active" : "pending" })))

    this.tracePlaybackTimer = window.setInterval(() => {
      activeIndex += 1
      if (activeIndex >= steps.length) {
        window.clearInterval(this.tracePlaybackTimer)
        this.tracePlaybackTimer = null
        activeIndex = steps.length - 1
      }

      this.renderTrace(steps.map((step, index) => ({
        ...step,
        status: index < activeIndex ? "complete" : index === activeIndex ? "active" : "pending"
      })))
    }, 900)
  }

  stopTracePlayback() {
    if (!this.tracePlaybackTimer) return

    window.clearInterval(this.tracePlaybackTimer)
    this.tracePlaybackTimer = null
  }

  traceTone(status) {
    switch (status) {
      case "active":
        return {
          border: "border-blue-500/30",
          bg: "bg-blue-500/10",
          dot: "bg-blue-400 animate-pulse",
          title: "text-blue-100",
          detail: "text-blue-100/80"
        }
      case "complete":
        return {
          border: "border-emerald-500/20",
          bg: "bg-emerald-500/10",
          dot: "bg-emerald-400",
          title: "text-emerald-100",
          detail: "text-emerald-100/75"
        }
      case "error":
        return {
          border: "border-red-500/30",
          bg: "bg-red-500/10",
          dot: "bg-red-400",
          title: "text-red-100",
          detail: "text-red-100/75"
        }
      default:
        return {
          border: "border-gray-800",
          bg: "bg-gray-800/50",
          dot: "bg-gray-500",
          title: "text-gray-200",
          detail: "text-gray-400"
        }
    }
  }

  previewText(text, maxLength) {
    const normalized = (text || "").replace(/\s+/g, " ").trim()
    if (normalized.length <= maxLength) return normalized
    return `${normalized.slice(0, maxLength)}...`
  }

  escapeAttribute(text) {
    return this.escapeHtml(text).replace(/"/g, "&quot;")
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
