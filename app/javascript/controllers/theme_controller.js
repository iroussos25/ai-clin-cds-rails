import { Controller } from "@hotwired/stimulus"

const STORAGE_KEY = "theme"

export default class extends Controller {
  static targets = ["label", "sun", "moon"]

  connect() {
    this.applySavedTheme()
    this.syncUi()
  }

  toggle() {
    const isDark = document.documentElement.classList.toggle("dark")
    localStorage.setItem(STORAGE_KEY, isDark ? "dark" : "light")
    this.syncUi()
  }

  applySavedTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEY)

    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark")
      return
    }

    if (savedTheme === "light") {
      document.documentElement.classList.remove("dark")
      return
    }

    const prefersDark =
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches

    document.documentElement.classList.toggle("dark", prefersDark)
  }

  syncUi() {
    const isDark = document.documentElement.classList.contains("dark")

    if (this.hasLabelTarget) {
      this.labelTarget.textContent = isDark ? "Dark" : "Light"
    }

    if (this.hasSunTarget) {
      this.sunTarget.classList.toggle("hidden", isDark)
    }

    if (this.hasMoonTarget) {
      this.moonTarget.classList.toggle("hidden", !isDark)
    }

    this.element.setAttribute("aria-pressed", String(isDark))
  }
}
