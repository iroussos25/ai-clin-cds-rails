import { Controller } from "@hotwired/stimulus"

// File upload controller with drag-and-drop
export default class extends Controller {
  static targets = ["input", "status"]
  static values = { url: String }

  click() {
    this.inputTarget.click()
  }

  dragover(event) {
    event.preventDefault()
    this.element.classList.add("border-blue-500", "bg-blue-500/5")
  }

  dragenter(event) {
    event.preventDefault()
  }

  dragleave() {
    this.element.classList.remove("border-blue-500", "bg-blue-500/5")
  }

  drop(event) {
    event.preventDefault()
    this.element.classList.remove("border-blue-500", "bg-blue-500/5")
    const file = event.dataTransfer.files[0]
    if (file) this.upload(file)
  }

  fileSelected() {
    const file = this.inputTarget.files[0]
    if (file) this.upload(file)
  }

  async upload(file) {
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      this.showStatus("File too large (max 10MB)", "error")
      return
    }

    this.showStatus(`Uploading ${file.name}...`, "info")

    const formData = new FormData()
    formData.append("file", file)

    const csrfToken = document.querySelector("meta[name='csrf-token']")?.content

    try {
      const response = await fetch(this.urlValue, {
        method: "POST",
        headers: { "X-CSRF-Token": csrfToken },
        body: formData
      })

      const data = await response.json()

      if (response.ok) {
        this.showStatus(`Uploaded: ${data.content?.length || 0} characters extracted`, "success")
        // Dispatch event for parent controller to pick up the text
        this.dispatch("complete", { detail: { content: data.content, filename: file.name } })
      } else {
        this.showStatus(`Error: ${data.error || "Upload failed"}`, "error")
      }
    } catch (error) {
      this.showStatus(`Network error: ${error.message}`, "error")
    }
  }

  showStatus(message, type) {
    this.statusTarget.classList.remove("hidden")
    const colors = {
      info: "text-blue-400",
      success: "text-green-400",
      error: "text-red-400"
    }
    this.statusTarget.className = `mt-2 text-xs ${colors[type] || "text-gray-400"}`
    this.statusTarget.textContent = message
  }
}
