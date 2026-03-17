import { Controller } from "@hotwired/stimulus"

// FHIR Explorer controller - queries FHIR R4 servers, assembles patient picture, imports to workbench
export default class extends Controller {
  static targets = [
    "serverUrl", "connectBtn", "connectionStatus",
    "resourceType", "searchParams", "searchBtn",
    "results", "resultCount",
    "cartList", "cartCount", "clearCartBtn", "importBtn", "addAllBtn",
    "previewPanel", "previewText"
  ]

  connect() {
    this.connected = false
    this.cart = []           // Array of { resource, key }
    this.lastResults = []    // Last search results for "add all"
  }

  // ── Connection ──

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
          `<span class="text-green-400">Connected — FHIR ${data.fhirVersion || "R4"}</span>`
      } else {
        this.connectionStatusTarget.innerHTML =
          `<span class="text-red-400">Failed (HTTP ${response.status})</span>`
      }
    } catch (error) {
      this.connectionStatusTarget.innerHTML =
        `<span class="text-red-400">Connection error: ${this.escapeHtml(error.message)}</span>`
    } finally {
      this.connectBtnTarget.disabled = false
    }
  }

  // ── Search ──

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
        this.lastResults = data.entry.map(e => e.resource)
        this.resultCountTarget.textContent = `${data.entry.length} of ${data.total || "?"} results`
        this.resultsTarget.innerHTML = this.lastResults.map(r => this._renderResource(r)).join("")
        if (this.hasAddAllBtnTarget) this.addAllBtnTarget.classList.remove("hidden")
      } else {
        this.lastResults = []
        this.resultCountTarget.textContent = "0 results"
        this.resultsTarget.innerHTML = '<p class="text-gray-600 text-sm p-4 text-center">No resources found</p>'
        if (this.hasAddAllBtnTarget) this.addAllBtnTarget.classList.add("hidden")
      }
    } catch (error) {
      this.resultsTarget.innerHTML = `<p class="text-red-400 text-sm p-4">Search error: ${this.escapeHtml(error.message)}</p>`
    } finally {
      this.searchBtnTarget.disabled = false
    }
  }

  // ── Result rendering ──

  _renderResource(resource) {
    const type = resource.resourceType || "Unknown"
    const id = resource.id || "—"
    const key = `${type}/${id}`
    const summary = this._summarize(resource)
    const inCart = this.cart.some(c => c.key === key)

    return `
      <div class="border-b border-gray-800 p-3 hover:bg-gray-800/50 transition-colors group" data-resource-key="${this.escapeHtml(key)}">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 flex-1 cursor-pointer" data-action="click->fhir#toggleDetails" data-resource='${JSON.stringify(resource).replace(/'/g, "&#39;")}'>
            <span class="expand-arrow text-xs text-gray-600">▸</span>
            <span class="text-xs font-mono text-blue-400">${this.escapeHtml(type)}</span>
            <span class="text-xs text-gray-600">${this.escapeHtml(id)}</span>
          </div>
          <button type="button"
                  data-action="click->fhir#addToCart"
                  data-resource='${JSON.stringify(resource).replace(/'/g, "&#39;")}'
                  class="cart-add-btn shrink-0 px-2 py-1 text-xs rounded transition-colors ${inCart ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700' : 'bg-gray-800 text-gray-400 hover:text-emerald-400 hover:bg-emerald-900/30 border border-gray-700'}">
            ${inCart ? "✓ In cart" : "+ Add"}
          </button>
        </div>
        <p class="text-sm text-gray-300 mt-1 ml-5">${this.escapeHtml(summary)}</p>
      </div>
    `
  }

  toggleDetails(event) {
    const row = event.currentTarget.closest("[data-resource-key]")
    const existing = row.querySelector(".resource-details")

    if (existing) {
      existing.remove()
      row.querySelector(".expand-arrow").textContent = "▸"
      return
    }

    row.querySelector(".expand-arrow").textContent = "▾"
    const resource = JSON.parse(event.currentTarget.dataset.resource)
    const wrapper = document.createElement("div")
    wrapper.className = "resource-details mt-3 ml-5 p-3 bg-gray-800/80 rounded-lg border border-gray-700 text-sm space-y-1 max-h-80 overflow-y-auto"
    wrapper.innerHTML = this._renderDetails(resource)
    row.appendChild(wrapper)
  }

  // ── Cart management ──

  addToCart(event) {
    event.stopPropagation()
    const resource = JSON.parse(event.currentTarget.dataset.resource)
    const key = `${resource.resourceType}/${resource.id}`

    if (this.cart.some(c => c.key === key)) return // already in cart

    this.cart.push({ resource, key })
    this._updateCartUI()
    this._updateResultButtons()
  }

  addAllVisible() {
    let added = 0
    for (const resource of this.lastResults) {
      const key = `${resource.resourceType}/${resource.id}`
      if (!this.cart.some(c => c.key === key)) {
        this.cart.push({ resource, key })
        added++
      }
    }
    if (added > 0) {
      this._updateCartUI()
      this._updateResultButtons()
    }
  }

  removeFromCart(event) {
    event.stopPropagation()
    const key = event.currentTarget.dataset.cartKey
    this.cart = this.cart.filter(c => c.key !== key)
    this._updateCartUI()
    this._updateResultButtons()
  }

  clearCart() {
    this.cart = []
    this._updateCartUI()
    this._updateResultButtons()
    if (this.hasPreviewPanelTarget) this.previewPanelTarget.classList.add("hidden")
  }

  _updateCartUI() {
    const count = this.cart.length
    this.cartCountTarget.textContent = count
    this.cartCountTarget.className = count > 0
      ? "text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400"
      : "text-xs font-mono px-2 py-0.5 rounded-full bg-gray-800 text-gray-500"

    this.clearCartBtnTarget.disabled = count === 0
    this.importBtnTarget.disabled = count === 0

    if (count === 0) {
      this.cartListTarget.innerHTML = '<p class="text-gray-600 text-center py-2">Add resources from search results</p>'
      return
    }

    // Group by type
    const groups = {}
    for (const { resource, key } of this.cart) {
      const type = resource.resourceType
      if (!groups[type]) groups[type] = []
      groups[type].push({ resource, key })
    }

    let html = ""
    for (const [type, items] of Object.entries(groups)) {
      html += `<div class="text-gray-500 font-medium text-xs mt-1 first:mt-0">${this.escapeHtml(type)} (${items.length})</div>`
      for (const { resource, key } of items) {
        html += `<div class="flex items-center justify-between py-0.5 pl-2">
          <span class="text-gray-400 text-xs truncate flex-1">${this.escapeHtml(this._summarize(resource))}</span>
          <button type="button" data-action="click->fhir#removeFromCart" data-cart-key="${this.escapeHtml(key)}"
                  class="text-gray-600 hover:text-red-400 text-xs ml-1 shrink-0 transition-colors">✕</button>
        </div>`
      }
    }
    this.cartListTarget.innerHTML = html
  }

  _updateResultButtons() {
    const buttons = this.resultsTarget.querySelectorAll(".cart-add-btn")
    buttons.forEach(btn => {
      const resource = JSON.parse(btn.dataset.resource)
      const key = `${resource.resourceType}/${resource.id}`
      const inCart = this.cart.some(c => c.key === key)
      btn.innerHTML = inCart ? "✓ In cart" : "+ Add"
      btn.className = `cart-add-btn shrink-0 px-2 py-1 text-xs rounded transition-colors ${inCart ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-700' : 'bg-gray-800 text-gray-400 hover:text-emerald-400 hover:bg-emerald-900/30 border border-gray-700'}`
    })
  }

  // ── Compose & Import ──

  composeAndImport() {
    if (this.cart.length === 0) return
    const narrative = this._composeNarrative()
    this.previewTextTarget.textContent = narrative
    this.previewPanelTarget.classList.remove("hidden")
    this.previewPanelTarget.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  editComposed() {
    // Convert preview to editable textarea
    const current = this.previewTextTarget.textContent
    const textarea = document.createElement("textarea")
    textarea.className = "w-full bg-gray-800 border border-gray-700 rounded-lg p-4 text-xs text-gray-300 leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
    textarea.rows = 16
    textarea.value = current
    textarea.dataset.fhirTarget = "previewText"
    this.previewTextTarget.replaceWith(textarea)
  }

  sendToWorkbench() {
    const text = this.previewTextTarget.value || this.previewTextTarget.textContent
    if (!text?.trim()) return

    window.dispatchEvent(new CustomEvent("fhir:import", {
      detail: { clinicalText: text.trim() }
    }))

    // Switch to workbench panel
    window.dispatchEvent(new CustomEvent("navigation:switch", {
      detail: { panel: "workbench" }
    }))

    this.previewPanelTarget.classList.add("hidden")
  }

  // ── Narrative composition ──

  _composeNarrative() {
    const groups = {}
    for (const { resource } of this.cart) {
      const type = resource.resourceType
      if (!groups[type]) groups[type] = []
      groups[type].push(resource)
    }

    const sections = []

    // Patient demographics first
    if (groups.Patient) {
      for (const p of groups.Patient) {
        sections.push(this._narrativePatient(p))
      }
      delete groups.Patient
    }

    // Active conditions
    if (groups.Condition) {
      sections.push("ACTIVE CONDITIONS / DIAGNOSES:")
      for (const c of groups.Condition) sections.push(this._narrativeCondition(c))
      delete groups.Condition
    }

    // Medications
    if (groups.MedicationRequest) {
      sections.push("\nMEDICATIONS:")
      for (const m of groups.MedicationRequest) sections.push(this._narrativeMedication(m))
      delete groups.MedicationRequest
    }

    // Allergies
    if (groups.AllergyIntolerance) {
      sections.push("\nALLERGIES:")
      for (const a of groups.AllergyIntolerance) sections.push(this._narrativeAllergy(a))
      delete groups.AllergyIntolerance
    }

    // Observations / Labs / Vitals
    if (groups.Observation) {
      const labs = groups.Observation.filter(o => o.category?.some(c => c.coding?.some(cd => cd.code === "laboratory")))
      const vitals = groups.Observation.filter(o => o.category?.some(c => c.coding?.some(cd => cd.code === "vital-signs")))
      const other = groups.Observation.filter(o => !labs.includes(o) && !vitals.includes(o))

      if (vitals.length) {
        sections.push("\nVITAL SIGNS:")
        for (const v of vitals) sections.push(this._narrativeObservation(v))
      }
      if (labs.length) {
        sections.push("\nLABORATORY RESULTS:")
        for (const l of labs) sections.push(this._narrativeObservation(l))
      }
      if (other.length) {
        sections.push("\nOBSERVATIONS:")
        for (const o of other) sections.push(this._narrativeObservation(o))
      }
      delete groups.Observation
    }

    // Encounters
    if (groups.Encounter) {
      sections.push("\nENCOUNTER HISTORY:")
      for (const e of groups.Encounter) sections.push(this._narrativeEncounter(e))
      delete groups.Encounter
    }

    // Diagnostic Reports
    if (groups.DiagnosticReport) {
      sections.push("\nDIAGNOSTIC REPORTS:")
      for (const d of groups.DiagnosticReport) sections.push(this._narrativeDiagnosticReport(d))
      delete groups.DiagnosticReport
    }

    // Procedures
    if (groups.Procedure) {
      sections.push("\nPROCEDURES:")
      for (const p of groups.Procedure) sections.push(this._narrativeProcedure(p))
      delete groups.Procedure
    }

    // Any remaining types
    for (const [type, resources] of Object.entries(groups)) {
      sections.push(`\n${type.toUpperCase()}:`)
      for (const r of resources) sections.push(`- ${this._summarize(r)}`)
    }

    sections.push("\n---")
    sections.push(`Source: FHIR R4 — ${this.serverUrlTarget.value.trim()}`)
    sections.push(`Assembled: ${new Date().toLocaleString()}`)
    sections.push(`Resources: ${this.cart.length} total`)

    return sections.join("\n")
  }

  _narrativePatient(p) {
    const parts = ["PATIENT DEMOGRAPHICS:"]
    const name = p.name?.[0]
    if (name) parts.push(`Name: ${[name.prefix, name.given?.join(" "), name.family].flat().filter(Boolean).join(" ")}`)
    if (p.birthDate) parts.push(`DOB: ${p.birthDate}`)
    if (p.gender) parts.push(`Gender: ${p.gender.charAt(0).toUpperCase() + p.gender.slice(1)}`)
    const mrn = p.identifier?.find(i => i.type?.coding?.[0]?.code === "MR")
    if (mrn) parts.push(`MRN: ${mrn.value}`)
    if (p.maritalStatus) parts.push(`Marital Status: ${this._codeable(p.maritalStatus)}`)
    if (p.address?.length) {
      parts.push(`Address: ${[p.address[0].line?.join(", "), p.address[0].city, p.address[0].state, p.address[0].postalCode].filter(Boolean).join(", ")}`)
    }
    if (p.communication?.length) {
      parts.push(`Language: ${p.communication.map(c => this._codeable(c.language)).filter(Boolean).join(", ")}`)
    }
    return parts.join("\n")
  }

  _narrativeCondition(c) {
    const display = this._codeable(c.code)
    const status = c.clinicalStatus ? ` [${this._codeable(c.clinicalStatus)}]` : ""
    const onset = c.onsetDateTime ? ` (onset: ${c.onsetDateTime})` : ""
    return `- ${display}${status}${onset}`
  }

  _narrativeMedication(m) {
    const med = m.medicationCodeableConcept ? this._codeable(m.medicationCodeableConcept) : m.medicationReference?.display || "Unknown"
    const dosage = m.dosageInstruction?.[0]?.text || ""
    const status = m.status ? ` [${m.status}]` : ""
    return dosage ? `- ${med}${status}: ${dosage}` : `- ${med}${status}`
  }

  _narrativeAllergy(a) {
    const allergen = this._codeable(a.code)
    const crit = a.criticality ? ` (${a.criticality})` : ""
    const reactions = a.reaction?.map(rx =>
      rx.manifestation?.map(m => this._codeable(m)).join(", ")
    ).filter(Boolean).join("; ")
    return reactions ? `- ${allergen}${crit}: ${reactions}` : `- ${allergen}${crit}`
  }

  _narrativeObservation(o) {
    const display = this._codeable(o.code)
    let value = ""
    if (o.valueQuantity) value = `${o.valueQuantity.value} ${o.valueQuantity.unit || ""}`
    else if (o.valueString) value = o.valueString
    else if (o.valueCodeableConcept) value = this._codeable(o.valueCodeableConcept)

    const interp = o.interpretation?.map(i => this._codeable(i)).join(", ")
    const date = o.effectiveDateTime ? ` (${o.effectiveDateTime.slice(0, 10)})` : ""
    let line = value ? `- ${display}: ${value}` : `- ${display}`
    if (interp) line += ` [${interp}]`
    line += date
    return line
  }

  _narrativeEncounter(e) {
    const type = e.type?.[0] ? this._codeable(e.type[0]) : e.class?.display || e.class?.code || "Encounter"
    const status = e.status ? ` [${e.status}]` : ""
    const period = e.period?.start ? ` (${e.period.start.slice(0, 10)})` : ""
    return `- ${type}${status}${period}`
  }

  _narrativeDiagnosticReport(d) {
    const display = this._codeable(d.code)
    const status = d.status ? ` [${d.status}]` : ""
    const date = d.effectiveDateTime ? ` (${d.effectiveDateTime.slice(0, 10)})` : ""
    const conclusion = d.conclusion ? `\n  Conclusion: ${d.conclusion}` : ""
    return `- ${display}${status}${date}${conclusion}`
  }

  _narrativeProcedure(p) {
    const display = this._codeable(p.code)
    const status = p.status ? ` [${p.status}]` : ""
    const date = p.performedDateTime ? ` (${p.performedDateTime.slice(0, 10)})` : ""
    return `- ${display}${status}${date}`
  }

  // ── Human-readable detail renderers ──

  _renderDetails(r) {
    switch (r.resourceType) {
      case "Patient":           return this._detailPatient(r)
      case "Observation":       return this._detailObservation(r)
      case "Condition":         return this._detailCondition(r)
      case "MedicationRequest": return this._detailMedicationRequest(r)
      case "Encounter":         return this._detailEncounter(r)
      case "DiagnosticReport":  return this._detailDiagnosticReport(r)
      case "Procedure":         return this._detailProcedure(r)
      case "AllergyIntolerance":return this._detailAllergy(r)
      default:                  return this._detailGeneric(r)
    }
  }

  _detailPatient(r) {
    const rows = []
    const name = r.name?.[0]
    if (name) rows.push(this._row("Name", [name.prefix, name.given?.join(" "), name.family, name.suffix].flat().filter(Boolean).join(" ")))
    if (r.birthDate)   rows.push(this._row("Date of Birth", this._fmtDate(r.birthDate)))
    if (r.gender)      rows.push(this._row("Gender", this._titleCase(r.gender)))
    if (r.deceasedBoolean !== undefined) rows.push(this._row("Deceased", r.deceasedBoolean ? "Yes" : "No"))
    if (r.deceasedDateTime) rows.push(this._row("Deceased", this._fmtDate(r.deceasedDateTime)))
    if (r.maritalStatus) rows.push(this._row("Marital Status", this._codeable(r.maritalStatus)))
    const mrn = r.identifier?.find(i => i.type?.coding?.[0]?.code === "MR")
    if (mrn) rows.push(this._row("MRN", mrn.value))
    else if (r.identifier?.[0]) rows.push(this._row("Identifier", r.identifier[0].value))
    if (r.telecom?.length) {
      r.telecom.forEach(t => rows.push(this._row(this._titleCase(t.system || "Contact"), t.value)))
    }
    if (r.address?.length) {
      r.address.forEach(a => rows.push(this._row("Address", [a.line?.join(", "), a.city, a.state, a.postalCode, a.country].filter(Boolean).join(", "))))
    }
    if (r.communication?.length) {
      const langs = r.communication.map(c => this._codeable(c.language)).filter(Boolean).join(", ")
      if (langs) rows.push(this._row("Language", langs))
    }
    return rows.join("") || this._row("Info", "No details available")
  }

  _detailObservation(r) {
    const rows = []
    rows.push(this._row("Code", this._codeable(r.code)))
    if (r.status) rows.push(this._row("Status", this._titleCase(r.status)))
    if (r.category?.length) rows.push(this._row("Category", r.category.map(c => this._codeable(c)).join(", ")))
    // Value display
    if (r.valueQuantity) rows.push(this._row("Value", `${r.valueQuantity.value} ${r.valueQuantity.unit || r.valueQuantity.code || ""}`))
    else if (r.valueCodeableConcept) rows.push(this._row("Value", this._codeable(r.valueCodeableConcept)))
    else if (r.valueString) rows.push(this._row("Value", r.valueString))
    else if (r.valueBoolean !== undefined) rows.push(this._row("Value", r.valueBoolean ? "Yes" : "No"))
    if (r.interpretation?.length) rows.push(this._row("Interpretation", r.interpretation.map(i => this._codeable(i)).join(", ")))
    if (r.referenceRange?.length) {
      const rr = r.referenceRange[0]
      const lo = rr.low ? `${rr.low.value} ${rr.low.unit || ""}` : ""
      const hi = rr.high ? `${rr.high.value} ${rr.high.unit || ""}` : ""
      if (lo || hi) rows.push(this._row("Ref. Range", [lo, hi].filter(Boolean).join(" – ")))
    }
    if (r.effectiveDateTime) rows.push(this._row("Date", this._fmtDate(r.effectiveDateTime)))
    if (r.subject?.display) rows.push(this._row("Patient", r.subject.display))
    return rows.join("")
  }

  _detailCondition(r) {
    const rows = []
    rows.push(this._row("Condition", this._codeable(r.code)))
    if (r.clinicalStatus) rows.push(this._row("Clinical Status", this._codeable(r.clinicalStatus)))
    if (r.verificationStatus) rows.push(this._row("Verification", this._codeable(r.verificationStatus)))
    if (r.category?.length) rows.push(this._row("Category", r.category.map(c => this._codeable(c)).join(", ")))
    if (r.severity) rows.push(this._row("Severity", this._codeable(r.severity)))
    if (r.onsetDateTime) rows.push(this._row("Onset", this._fmtDate(r.onsetDateTime)))
    else if (r.onsetAge) rows.push(this._row("Onset Age", `${r.onsetAge.value} ${r.onsetAge.unit || ""}`))
    else if (r.onsetString) rows.push(this._row("Onset", r.onsetString))
    if (r.abatementDateTime) rows.push(this._row("Resolved", this._fmtDate(r.abatementDateTime)))
    if (r.recordedDate) rows.push(this._row("Recorded", this._fmtDate(r.recordedDate)))
    if (r.subject?.display) rows.push(this._row("Patient", r.subject.display))
    if (r.note?.length) rows.push(this._row("Note", r.note.map(n => n.text).join("; ")))
    return rows.join("")
  }

  _detailMedicationRequest(r) {
    const rows = []
    const med = r.medicationCodeableConcept ? this._codeable(r.medicationCodeableConcept) : r.medicationReference?.display || "—"
    rows.push(this._row("Medication", med))
    if (r.status) rows.push(this._row("Status", this._titleCase(r.status)))
    if (r.intent) rows.push(this._row("Intent", this._titleCase(r.intent)))
    if (r.authoredOn) rows.push(this._row("Authored", this._fmtDate(r.authoredOn)))
    if (r.dosageInstruction?.length) {
      r.dosageInstruction.forEach(d => {
        if (d.text) rows.push(this._row("Dosage", d.text))
        else {
          const parts = []
          if (d.doseAndRate?.[0]?.doseQuantity) {
            const dq = d.doseAndRate[0].doseQuantity
            parts.push(`${dq.value} ${dq.unit || ""}`)
          }
          if (d.route) parts.push(this._codeable(d.route))
          if (d.timing?.code) parts.push(this._codeable(d.timing.code))
          else if (d.timing?.repeat?.frequency && d.timing?.repeat?.period) {
            parts.push(`${d.timing.repeat.frequency}x per ${d.timing.repeat.period} ${d.timing.repeat.periodUnit || ""}`)
          }
          if (parts.length) rows.push(this._row("Dosage", parts.join(", ")))
        }
      })
    }
    if (r.requester?.display) rows.push(this._row("Prescriber", r.requester.display))
    if (r.subject?.display) rows.push(this._row("Patient", r.subject.display))
    if (r.reasonCode?.length) rows.push(this._row("Reason", r.reasonCode.map(c => this._codeable(c)).join(", ")))
    return rows.join("")
  }

  _detailEncounter(r) {
    const rows = []
    if (r.class) rows.push(this._row("Class", r.class.display || r.class.code || "—"))
    if (r.type?.length) rows.push(this._row("Type", r.type.map(t => this._codeable(t)).join(", ")))
    if (r.status) rows.push(this._row("Status", this._titleCase(r.status)))
    if (r.period) {
      const start = r.period.start ? this._fmtDate(r.period.start) : "?"
      const end = r.period.end ? this._fmtDate(r.period.end) : "ongoing"
      rows.push(this._row("Period", `${start} → ${end}`))
    }
    if (r.reasonCode?.length) rows.push(this._row("Reason", r.reasonCode.map(c => this._codeable(c)).join(", ")))
    if (r.participant?.length) {
      r.participant.forEach(p => {
        const role = p.type?.[0]?.coding?.[0]?.display || p.type?.[0]?.text || "Participant"
        rows.push(this._row(role, p.individual?.display || "—"))
      })
    }
    if (r.subject?.display) rows.push(this._row("Patient", r.subject.display))
    if (r.serviceProvider?.display) rows.push(this._row("Provider", r.serviceProvider.display))
    return rows.join("")
  }

  _detailDiagnosticReport(r) {
    const rows = []
    rows.push(this._row("Report", this._codeable(r.code)))
    if (r.status) rows.push(this._row("Status", this._titleCase(r.status)))
    if (r.category?.length) rows.push(this._row("Category", r.category.map(c => this._codeable(c)).join(", ")))
    if (r.effectiveDateTime) rows.push(this._row("Effective", this._fmtDate(r.effectiveDateTime)))
    if (r.issued) rows.push(this._row("Issued", this._fmtDate(r.issued)))
    if (r.result?.length) {
      r.result.forEach(ref => rows.push(this._row("Result", ref.display || ref.reference || "—")))
    }
    if (r.conclusion) rows.push(this._row("Conclusion", r.conclusion))
    if (r.performer?.length) rows.push(this._row("Performer", r.performer.map(p => p.display || p.reference).join(", ")))
    if (r.subject?.display) rows.push(this._row("Patient", r.subject.display))
    return rows.join("")
  }

  _detailProcedure(r) {
    const rows = []
    rows.push(this._row("Procedure", this._codeable(r.code)))
    if (r.status) rows.push(this._row("Status", this._titleCase(r.status)))
    if (r.category) rows.push(this._row("Category", this._codeable(r.category)))
    if (r.performedDateTime) rows.push(this._row("Performed", this._fmtDate(r.performedDateTime)))
    else if (r.performedPeriod) {
      const start = r.performedPeriod.start ? this._fmtDate(r.performedPeriod.start) : "?"
      const end = r.performedPeriod.end ? this._fmtDate(r.performedPeriod.end) : "ongoing"
      rows.push(this._row("Performed", `${start} → ${end}`))
    }
    if (r.performer?.length) {
      r.performer.forEach(p => rows.push(this._row("Performer", p.actor?.display || "—")))
    }
    if (r.reasonCode?.length) rows.push(this._row("Reason", r.reasonCode.map(c => this._codeable(c)).join(", ")))
    if (r.bodySite?.length) rows.push(this._row("Body Site", r.bodySite.map(b => this._codeable(b)).join(", ")))
    if (r.subject?.display) rows.push(this._row("Patient", r.subject.display))
    if (r.note?.length) rows.push(this._row("Note", r.note.map(n => n.text).join("; ")))
    return rows.join("")
  }

  _detailAllergy(r) {
    const rows = []
    rows.push(this._row("Allergen", this._codeable(r.code)))
    if (r.clinicalStatus) rows.push(this._row("Clinical Status", this._codeable(r.clinicalStatus)))
    if (r.verificationStatus) rows.push(this._row("Verification", this._codeable(r.verificationStatus)))
    if (r.type) rows.push(this._row("Type", this._titleCase(r.type)))
    if (r.category?.length) rows.push(this._row("Category", r.category.map(c => this._titleCase(c)).join(", ")))
    if (r.criticality) rows.push(this._row("Criticality", this._titleCase(r.criticality)))
    if (r.onsetDateTime) rows.push(this._row("Onset", this._fmtDate(r.onsetDateTime)))
    if (r.reaction?.length) {
      r.reaction.forEach(rx => {
        const manifestations = rx.manifestation?.map(m => this._codeable(m)).join(", ") || "—"
        const severity = rx.severity ? ` (${this._titleCase(rx.severity)})` : ""
        rows.push(this._row("Reaction", manifestations + severity))
      })
    }
    if (r.patient?.display) rows.push(this._row("Patient", r.patient.display))
    if (r.note?.length) rows.push(this._row("Note", r.note.map(n => n.text).join("; ")))
    return rows.join("")
  }

  _detailGeneric(r) {
    const skip = new Set(["resourceType", "id", "meta", "text"])
    const rows = []
    for (const [key, val] of Object.entries(r)) {
      if (skip.has(key)) continue
      if (val == null) continue
      if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
        rows.push(this._row(this._labelFromKey(key), String(val)))
      } else if (val?.coding || val?.text) {
        rows.push(this._row(this._labelFromKey(key), this._codeable(val)))
      } else if (val?.display) {
        rows.push(this._row(this._labelFromKey(key), val.display))
      }
    }
    return rows.length ? rows.join("") : `<p class="text-gray-500 text-xs">No readable fields found</p>`
  }

  // ── Helpers ──

  _row(label, value) {
    return `<div class="flex gap-3 py-1 border-b border-gray-700/50 last:border-0">
      <span class="text-gray-500 text-xs w-28 shrink-0 font-medium">${this.escapeHtml(label)}</span>
      <span class="text-gray-300 text-xs">${this.escapeHtml(String(value || "—"))}</span>
    </div>`
  }

  _codeable(cc) {
    if (!cc) return "—"
    return cc.coding?.[0]?.display || cc.text || cc.coding?.[0]?.code || "—"
  }

  _fmtDate(iso) {
    if (!iso) return "—"
    try {
      const d = new Date(iso)
      if (iso.length <= 10) return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })
      return d.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    } catch { return iso }
  }

  _titleCase(s) {
    if (!s) return "—"
    return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ")
  }

  _labelFromKey(key) {
    return key.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase()).trim()
  }

  _summarize(resource) {
    switch (resource.resourceType) {
      case "Patient": {
        const name = resource.name?.[0]
        const fullName = [name?.given?.join(" "), name?.family].filter(Boolean).join(" ") || "Unknown"
        const info = [resource.gender, resource.birthDate].filter(Boolean).join(", ")
        return info ? `${fullName} (${info})` : fullName
      }
      case "Observation": {
        const display = resource.code?.coding?.[0]?.display || resource.code?.text || "Observation"
        if (resource.valueQuantity) return `${display}: ${resource.valueQuantity.value} ${resource.valueQuantity.unit || ""}`
        if (resource.valueString) return `${display}: ${resource.valueString}`
        return display
      }
      case "Condition":
        return resource.code?.coding?.[0]?.display || resource.code?.text || "Condition"
      case "MedicationRequest":
        return resource.medicationCodeableConcept?.coding?.[0]?.display || resource.medicationReference?.display || "Medication"
      case "Encounter": {
        const type = resource.type?.[0]?.coding?.[0]?.display || resource.type?.[0]?.text || resource.class?.display || "Encounter"
        return resource.status ? `${type} (${resource.status})` : type
      }
      case "DiagnosticReport":
        return resource.code?.coding?.[0]?.display || resource.code?.text || "Diagnostic Report"
      case "Procedure":
        return resource.code?.coding?.[0]?.display || resource.code?.text || "Procedure"
      case "AllergyIntolerance":
        return resource.code?.coding?.[0]?.display || resource.code?.text || "Allergy"
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
