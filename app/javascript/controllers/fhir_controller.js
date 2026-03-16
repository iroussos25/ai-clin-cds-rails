import { Controller } from "@hotwired/stimulus"

// FHIR Explorer controller - queries public/private FHIR R4 servers
export default class extends Controller {
  static targets = [
    "serverUrl", "connectBtn", "connectionStatus",
    "resourceType", "searchParams", "searchBtn",
    "results", "resultCount"
  ]

  connect() {
    this.connected = false
  }

  async testConnection() {
    const url = this.serverUrlTarget.value.trim()
    if (!url) return

    this.connectBtnTarget.disabled = true
    this.connectionStatusTarget.innerHTML = '<span class="text-blue-400">Connecting...</span>'

    try {
      const metadataUrl = new URL("metadata", url.endsWith("/") ? url : url + "/")
      metadataUrl.searchParams.set("_format", "json")
      const response = await fetch(metadataUrl.toString())

      if (response.ok) {
        const data = await response.json()
        this.connected = true
        this.connectionStatusTarget.innerHTML =
          `<span class="text-green-400">Connected - FHIR ${data.fhirVersion || "R4"}</span>`
      } else {
        this.connectionStatusTarget.innerHTML =
          `<span class="text-red-400">Failed (HTTP ${response.status})</span>`
      }
    } catch (error) {
      this.connectionStatusTarget.innerHTML =
        `<span class="text-red-400">Connection error: ${error.message}</span>`
    } finally {
      this.connectBtnTarget.disabled = false
    }
  }

  async search() {
    const baseUrl = this.serverUrlTarget.value.trim()
    const resourceType = this.resourceTypeTarget.value
    const params = this.searchParamsTarget.value.trim()

    if (!baseUrl) return

    this.searchBtnTarget.disabled = true
    this.resultsTarget.innerHTML = '<p class="text-blue-400 animate-pulse text-sm p-4">Searching...</p>'

    try {
      let searchUrl = new URL(
        resourceType,
        baseUrl.endsWith("/") ? baseUrl : baseUrl + "/"
      )
      searchUrl.searchParams.set("_format", "json")
      searchUrl.searchParams.set("_count", "20")

      if (params) {
        params.split("&").forEach(pair => {
          const [key, value] = pair.split("=")
          if (key && value) searchUrl.searchParams.set(key.trim(), value.trim())
        })
      }

      const response = await fetch(searchUrl.toString())
      const data = await response.json()

      if (data.entry?.length > 0) {
        this.resultCountTarget.textContent = `${data.entry.length} of ${data.total || "?"} results`
        this.resultsTarget.innerHTML = data.entry.map(e => this.renderResource(e.resource)).join("")
      } else {
        this.resultCountTarget.textContent = "0 results"
        this.resultsTarget.innerHTML = '<p class="text-gray-600 text-sm p-4 text-center">No resources found</p>'
      }
    } catch (error) {
      this.resultsTarget.innerHTML = `<p class="text-red-400 text-sm p-4">Search error: ${error.message}</p>`
    } finally {
      this.searchBtnTarget.disabled = false
    }
  }

  renderResource(resource) {
    const type = resource.resourceType || "Unknown"
    const id = resource.id || "—"
    const summary = this.summarizeResource(resource)

    return `
      <div class="border-b border-gray-800 p-3 hover:bg-gray-800/50 transition-colors cursor-pointer"
           data-action="click->fhir#toggleDetails"
           data-resource='${JSON.stringify(resource).replace(/'/g, "&#39;")}'>
        <div class="flex items-center justify-between">
          <div>
            <span class="text-xs font-mono text-blue-400">${this.escapeHtml(type)}</span>
            <span class="text-xs text-gray-600 ml-2">${this.escapeHtml(id)}</span>
          </div>
          <span class="text-xs text-gray-600">▸</span>
        </div>
        <p class="text-sm text-gray-300 mt-1">${this.escapeHtml(summary)}</p>
      </div>
    `
  }

  toggleDetails(event) {
    const el = event.currentTarget
    const existing = el.querySelector(".resource-details")

    if (existing) {
      existing.remove()
      return
    }

    const resource = JSON.parse(el.dataset.resource)
    const details = document.createElement("pre")
    details.className = "resource-details mt-2 p-3 bg-gray-800 rounded text-xs text-gray-400 overflow-x-auto max-h-64 overflow-y-auto"
    details.textContent = JSON.stringify(resource, null, 2)
    el.appendChild(details)
  }

  summarizeResource(resource) {
    switch (resource.resourceType) {
      case "Patient":
        const name = resource.name?.[0]
        return [name?.given?.join(" "), name?.family].filter(Boolean).join(" ") || "Unknown Patient"
      case "Observation":
        return resource.code?.coding?.[0]?.display || resource.code?.text || "Observation"
      case "Condition":
        return resource.code?.coding?.[0]?.display || resource.code?.text || "Condition"
      case "MedicationRequest":
        return resource.medicationCodeableConcept?.coding?.[0]?.display || "Medication"
      default:
        return resource.text?.div ? "Has narrative" : `${resource.resourceType}/${resource.id}`
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div")
    div.textContent = text || ""
    return div.innerHTML
  }
}
