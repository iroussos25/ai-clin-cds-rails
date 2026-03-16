import { Controller } from "@hotwired/stimulus"

// Manages sidebar navigation and panel switching
export default class extends Controller {
  static targets = ["tab", "panel"]

  switchPanel({ params: { panel } }) {
    // Update active tab styling
    this.tabTargets.forEach(tab => {
      const isActive = tab.dataset.panel === panel
      tab.classList.toggle("bg-blue-600/20", isActive)
      tab.classList.toggle("text-blue-400", isActive)
      tab.classList.toggle("border", isActive)
      tab.classList.toggle("border-blue-500/30", isActive)
      tab.classList.toggle("text-gray-400", !isActive)
    })

    // Show/hide panels
    this.panelTargets.forEach(p => {
      p.classList.toggle("hidden", p.dataset.panel !== panel)
    })

    // Update URL without reload
    const url = new URL(window.location)
    url.searchParams.set("panel", panel)
    history.pushState({}, "", url)
  }
}
