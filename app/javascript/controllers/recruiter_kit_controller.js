import { Controller } from "@hotwired/stimulus"

// Recruiter Kit controller — loads kits into workbench, guided demo, rubric scoring
export default class extends Controller {
  static targets = ["kitData", "demoGuide", "demoStep", "advanceBtn", "rubricCount", "rubricAvg"]

  connect() {
    this.kits = JSON.parse(this.kitDataTarget.textContent || "[]")
    this.rubricScores = {} // { kitId: { criterionIndex: score } }
    this.demoMode = false
    this.demoStepNum = 1
  }

  // -- Load in Workbench (no prompt) --
  loadInWorkbench({ params: { index } }) {
    const kit = this.kits[index]
    if (!kit) return
    this._sendToWorkbench(kit, "")
  }

  // -- Load with a specific prompt --
  loadWithPrompt({ params: { index, prompt: promptIndex } }) {
    const kit = this.kits[index]
    if (!kit) return
    const promptText = kit.prompts?.[promptIndex] || ""
    this._sendToWorkbench(kit, promptText)
  }

  // -- Start Guided Demo --
  startDemo({ params: { index } }) {
    const kit = this.kits[index]
    if (!kit) return

    // Load kit with first prompt pre-filled
    this._sendToWorkbench(kit, kit.prompts?.[0] || "")

    // Show demo guide
    this.demoMode = true
    this.demoStepNum = 1
    this._updateDemoUI()
    this.demoGuideTarget.classList.remove("hidden")
  }

  advanceDemo() {
    this.demoStepNum = Math.min(this.demoStepNum + 1, 4)
    this._updateDemoUI()
  }

  stopDemo() {
    this.demoMode = false
    this.demoStepNum = 1
    this.demoGuideTarget.classList.add("hidden")
  }

  // -- Rubric Scoring --
  setScore({ params: { kit: kitId, criterion, score } }) {
    if (!this.rubricScores[kitId]) this.rubricScores[kitId] = {}
    this.rubricScores[kitId][criterion] = score

    // Update button styles
    document.querySelectorAll(`[data-rubric-key="${kitId}-${criterion}"]`).forEach(btn => {
      const btnScore = parseInt(btn.dataset.recruiterKitScoreParam)
      const isSelected = btnScore === score
      btn.classList.toggle("bg-indigo-600", isSelected)
      btn.classList.toggle("text-white", isSelected)
      btn.classList.toggle("border-indigo-500", isSelected)
      btn.classList.toggle("border-gray-700", !isSelected)
      btn.classList.toggle("text-gray-500", !isSelected)
    })

    this._updateRubricDisplay(kitId)
  }

  clearScores({ params: { kit: kitId } }) {
    delete this.rubricScores[kitId]

    // Reset all button styles for this kit
    document.querySelectorAll(`[data-rubric-key^="${kitId}-"]`).forEach(btn => {
      btn.classList.remove("bg-indigo-600", "text-white", "border-indigo-500")
      btn.classList.add("border-gray-700", "text-gray-500")
    })

    this._updateRubricDisplay(kitId)
  }

  // -- Private --

  _sendToWorkbench(kit, promptText) {
    // Dispatch event for the analyze controller to pick up
    window.dispatchEvent(new CustomEvent("recruiter-kit:load", {
      detail: {
        title: kit.title,
        clinicalText: kit.clinical_text,
        prompt: promptText
      }
    }))

    // Switch to workbench panel
    window.dispatchEvent(new CustomEvent("navigation:switch", {
      detail: { panel: "workbench" }
    }))
  }

  _updateDemoUI() {
    this.demoStepTargets.forEach(el => {
      const step = parseInt(el.dataset.step)
      const isActive = step === this.demoStepNum
      const isDone = step < this.demoStepNum
      el.classList.toggle("bg-amber-400/20", isActive)
      el.classList.toggle("text-amber-100", isActive || isDone)
      el.classList.toggle("text-amber-300/60", !isActive && !isDone)
    })

    if (this.hasAdvanceBtnTarget) {
      this.advanceBtnTarget.textContent = this.demoStepNum >= 4 ? "Done" : "Next Step"
      if (this.demoStepNum >= 4) {
        this.advanceBtnTarget.dataset.action = "click->recruiter-kit#stopDemo"
      } else {
        this.advanceBtnTarget.dataset.action = "click->recruiter-kit#advanceDemo"
      }
    }
  }

  _updateRubricDisplay(kitId) {
    const scores = this.rubricScores[kitId] || {}
    const entries = Object.values(scores)
    const count = entries.length

    // Update count badge
    this.rubricCountTargets.forEach(el => {
      if (el.dataset.kit === kitId) {
        const total = el.textContent.match(/\/(\d+)/)?.[1] || "?"
        el.textContent = `Scored: ${count}/${total}`
      }
    })

    // Update average badge
    this.rubricAvgTargets.forEach(el => {
      if (el.dataset.kit === kitId) {
        if (count > 0) {
          const avg = (entries.reduce((a, b) => a + b, 0) / count).toFixed(1)
          el.textContent = `Avg: ${avg}`
          el.classList.remove("hidden")
        } else {
          el.classList.add("hidden")
        }
      }
    })
  }
}
