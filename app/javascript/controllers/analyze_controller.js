import { Controller } from "@hotwired/stimulus"

// Main analysis workbench controller
export default class extends Controller {
  static targets = [
    "input", "output", "charCount", "submitBtn", "submitText", "spinner",
    "copyBtn", "demoBtn", "reviewBtn", "disableRagToggle", "ragPanel", "ragResults",
    "traceContent", "loadingIndicator"
  ]

  connect() {
    this.csrfToken = document.querySelector("meta[name='csrf-token']")?.content
    this.reviewState = null
    this.tracePlaybackTimer = null
    this.updateDemoButtonState()
    this.updateReviewButtonState()
  }

  disconnect() {
    this.stopTracePlayback()
  }

  updateCharCount() {
    const count = this.inputTarget.value.length
    this.charCountTarget.textContent = `${count} characters`
    this.updateDemoButtonState()
    this.updateReviewButtonState()
  }

  uploadComplete({ detail: { content } }) {
    if (content) {
      this.inputTarget.value = content
      this.updateCharCount()
    }
  }

  loadDemo() {
    if (this.inputTarget.value.trim().length > 0) {
      this.clearAll()
      return
    }

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

  clearAll() {
    this.inputTarget.value = ""
    this.updateCharCount()

    this.outputTarget.innerHTML = `<div class="flex items-center justify-center h-64 text-gray-600">
      <p class="text-center">
        Analysis results will appear here.<br>
        <span class="text-xs">Paste clinical text and click Analyze to begin.</span>
      </p>
    </div>`

    this.copyBtnTarget.classList.add("hidden")
    this.ragPanelTarget.classList.add("hidden")
    this.ragResultsTarget.innerHTML = ""
    this.stopTracePlayback()
    this.traceContentTarget.innerHTML = this.tracePlaceholder()
    this.reviewState = null
    this.updateReviewButtonState()
  }

  async submit() {
    const text = this.inputTarget.value.trim()
    if (!text) return

    this.setLoading(true)
    this.startTracePlayback([
      {
        title: "Input processing",
        detail: `Validating ${text.length} characters of clinical text before analysis.`
      },
      {
        title: "RAG retrieval",
        detail: this.disableRagToggleTarget.checked ? "RAG has been disabled. The model will use only the supplied note." : "Checking the indexed corpus for relevant background context."
      },
      {
        title: "Model synthesis",
        detail: "Sending the grounded note to the model and waiting for the final synthesis."
      }
    ])

    try {
      const body = { text, use_rag: !this.disableRagToggleTarget.checked }

      let response, data
      for (let attempt = 0; attempt < 2; attempt++) {
        response = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": this.csrfToken
          },
          body: JSON.stringify(body)
        })

        data = await response.json()

        if (response.ok || response.status < 500) break
        if (attempt === 0) {
          console.debug("[Analyze] Server error, retrying...")
          await new Promise(r => setTimeout(r, 1500))
        }
      }

      if (response.ok) {
        const analysis = data.analysis || data.result
        this.outputTarget.innerHTML = this.renderMarkdown(analysis)
        this.copyBtnTarget.classList.remove("hidden")
        this.renderRagContexts(data.evidence || [])
        this.renderTrace(data.trace || [])
        this.saveReviewState({
          sourceText: text,
          analysis,
          model: data.model,
          trace: data.trace || []
        })
        this.updateReviewButtonState()
      } else {
        this.renderTrace([
          {
            title: "Analysis failed",
            detail: data.error || "The analysis request did not complete successfully.",
            status: "error"
          }
        ])
        this.outputTarget.innerHTML = `<div class="text-red-400">Error: ${data.error || "Analysis failed"}</div>`
      }
    } catch (error) {
      this.renderTrace([
        {
          title: "Network error",
          detail: error.message,
          status: "error"
        }
      ])
      this.outputTarget.innerHTML = `<div class="text-red-400">Network error: ${error.message}</div>`
    } finally {
      this.stopTracePlayback()
      this.setLoading(false)
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
    this.loadingIndicatorTarget.classList.toggle("hidden", !loading)
    this.submitTextTarget.textContent = loading ? "Analyzing..." : "Analyze Clinical Text"
  }

  updateDemoButtonState() {
    const hasText = this.inputTarget.value.trim().length > 0
    this.demoBtnTarget.textContent = hasText ? "Clear" : "Load Demo"
  }

  goToClinicalReview() {
    const reviewState = this.loadReviewState()
    if (!reviewState) return

    window.dispatchEvent(new CustomEvent("clinical-review:handoff", { detail: reviewState }))
    window.dispatchEvent(new CustomEvent("navigation:switch", { detail: { panel: "clinical-review" } }))
  }

  updateReviewButtonState() {
    const reviewState = this.loadReviewState()
    const hasReviewState = Boolean(reviewState?.analysis) && this.currentInputMatchesReviewState(reviewState)
    this.reviewBtnTarget.disabled = !hasReviewState
    this.reviewBtnTarget.classList.toggle("bg-gray-800", !hasReviewState)
    this.reviewBtnTarget.classList.toggle("text-gray-500", !hasReviewState)
    this.reviewBtnTarget.classList.toggle("border-gray-700", !hasReviewState)
    this.reviewBtnTarget.classList.toggle("cursor-not-allowed", !hasReviewState)
    this.reviewBtnTarget.classList.toggle("bg-emerald-600/20", hasReviewState)
    this.reviewBtnTarget.classList.toggle("text-emerald-300", hasReviewState)
    this.reviewBtnTarget.classList.toggle("border-emerald-500/30", hasReviewState)
    this.reviewBtnTarget.classList.toggle("hover:bg-emerald-600/30", hasReviewState)
    this.reviewBtnTarget.title = hasReviewState ? "Open Clinical Review with the current analyzed note" : "Run Analyze again after editing the note to enable Clinical Review"
  }

  currentInputMatchesReviewState(reviewState) {
    return (reviewState?.sourceText || "").trim() === this.inputTarget.value.trim()
  }

  saveReviewState(payload) {
    this.reviewState = payload
  }

  loadReviewState() {
    return this.reviewState
  }

  renderRagContexts(contexts) {
    if (!contexts.length) {
      this.ragPanelTarget.classList.add("hidden")
      this.ragResultsTarget.innerHTML = ""
      return
    }

    this.ragPanelTarget.classList.remove("hidden")
    this.ragResultsTarget.innerHTML = contexts.map((context, index) => `
      <div class="rounded-lg border border-gray-800 bg-gray-800/60 p-3">
        <div class="flex items-center justify-between gap-3">
          <p class="text-xs font-semibold uppercase tracking-wide text-cyan-300">[${this.escapeHtml(context.id || `R${index + 1}`)}] ${this.escapeHtml(context.source_label || "Indexed note evidence")}</p>
          <p class="text-[11px] text-gray-500">Chunk ${context.chunk_index ?? index} | score ${(context.similarity || 0).toFixed(3)}</p>
        </div>
        <p class="mt-2 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">${this.escapeHtml(context.content || "")}</p>
      </div>
    `).join("")
  }

  renderTrace(trace) {
    if (!trace.length) {
      this.traceContentTarget.innerHTML = this.tracePlaceholder()
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

  tracePlaceholder() {
    return `<p class="text-sm text-gray-500">Run an analysis to view the processing trace. This panel shows retrieval and workflow steps only, not hidden model reasoning.</p>`
  }

  renderMarkdown(text) {
    if (!text) return ""
    const normalizedText = this.normalizeCitationMarkers(text)
    return normalizedText
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-white mt-4 mb-2">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-white mt-4 mb-2">$1</h2>')
      .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
      .replace(/\n\n/g, "</p><p class='mt-2'>")
      .replace(/\n/g, "<br>")
  }

  normalizeCitationMarkers(text) {
    return (text || "")
      .replace(/\[N0\]/g, "[NOTE]")
      .replace(/\[R(\d+)\]/g, "[NOTE-CHUNK-$1]")
  }

  escapeHtml(text) {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
  }
}
