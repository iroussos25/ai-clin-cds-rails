import { Controller } from "@hotwired/stimulus"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

// Benchmarks controller — AI test suite + operational metrics
export default class extends Controller {
  static targets = [
    "tabBtn", "tabPanel",
    // Test suite
    "runsSelect", "runBtn", "clearBtn",
    "progressArea", "progressMsg", "progressPct", "progressBar",
    "summaryArea", "sumLatency", "sumCost", "sumConsistency", "sumSuccess",
    "resultsTable", "detailCards", "sortSelect",
    // Ops metrics
    "refreshBtn", "totalRequests", "avgLatency", "errorRate", "uptime",
    "routeTable", "modelUsage",
    "ciProvider", "ciConclusion", "ciBranch", "ciUpdatedAt", "ciRunLink", "ciMessage"
  ]

  connect() {
    this.benchmarkResults = null
    this.activeTab = "test-suite"
  }

  // ── Tab switching ──

  switchTab(event) {
    const tab = event.currentTarget.dataset.tab
    this.activeTab = tab

    this.tabBtnTargets.forEach(btn => {
      const isActive = btn.dataset.tab === tab
      btn.className = `px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${isActive ? "bg-blue-600/20 text-blue-400" : "text-gray-500 hover:text-gray-300"}`
    })

    this.tabPanelTargets.forEach(panel => {
      panel.classList.toggle("hidden", panel.dataset.tab !== tab)
    })
  }

  // ═══ TEST SUITE ═══

  async runTests() {
    const runsPerTest = parseInt(this.runsSelectTarget.value) || 2
    this.runBtnTarget.disabled = true
    this.runBtnTarget.textContent = "Running..."
    this.clearBtnTarget.disabled = true
    this.progressAreaTarget.classList.remove("hidden")
    this.summaryAreaTarget.classList.add("hidden")

    this._updateProgress("Initializing benchmarks...", 0)

    try {
      // Show per-scenario progress using a polling approach
      // The backend runs all scenarios synchronously, so we simulate progress
      const totalScenarios = 5
      let fakeProgress = 0
      const progressTimer = setInterval(() => {
        if (fakeProgress < 90) {
          fakeProgress += Math.random() * 8
          fakeProgress = Math.min(fakeProgress, 90)
          const scenarioIdx = Math.min(Math.floor(fakeProgress / (100 / totalScenarios)) + 1, totalScenarios)
          this._updateProgress(`Running scenario ${scenarioIdx} of ${totalScenarios}...`, fakeProgress)
        }
      }, 2000)

      const response = await fetch("/api/benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runs_per_test: runsPerTest })
      })

      clearInterval(progressTimer)

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      this.benchmarkResults = data

      this._updateProgress("Benchmarks complete!", 100)

      setTimeout(() => {
        this.progressAreaTarget.classList.add("hidden")
        this._renderSummary(data.summary)
        this._renderResults(data.results)
        this._renderDetails(data.results)
        this.summaryAreaTarget.classList.remove("hidden")
        this.clearBtnTarget.disabled = false
      }, 600)

    } catch (error) {
      this._updateProgress(`Error: ${error.message}`, 0)
    } finally {
      this.runBtnTarget.disabled = false
      this.runBtnTarget.textContent = "▶ Run Benchmarks"
    }
  }

  clearResults() {
    this.benchmarkResults = null
    this.summaryAreaTarget.classList.add("hidden")
    this.resultsTableTarget.innerHTML = ""
    this.detailCardsTarget.innerHTML = ""
    this.clearBtnTarget.disabled = true
  }

  sortResults() {
    if (!this.benchmarkResults) return
    this._renderResults(this.benchmarkResults.results)
    this._renderDetails(this.benchmarkResults.results)
  }

  _updateProgress(msg, pct) {
    this.progressMsgTarget.textContent = msg
    this.progressPctTarget.textContent = `${Math.round(pct)}%`
    this.progressBarTarget.style.width = `${pct}%`
  }

  _renderSummary(summary) {
    this.sumLatencyTarget.textContent = `${summary.avg_latency_ms}ms`
    this.sumCostTarget.textContent = `$${summary.total_cost.toFixed(5)}`
    this.sumConsistencyTarget.textContent = `${summary.avg_consistency}%`
    this.sumSuccessTarget.textContent = `${summary.overall_success_rate}%`
  }

  _renderResults(results) {
    const sorted = this._sortedResults(results)

    this.resultsTableTarget.innerHTML = sorted.map(r => `
      <tr class="border-b border-gray-800/50 hover:bg-gray-800/30">
        <td class="py-2.5 px-3">
          <div class="text-gray-300 text-sm font-medium">${this._esc(r.test_name)}</div>
          <div class="text-gray-600 text-xs">${this._esc(r.description)}</div>
        </td>
        <td class="py-2.5 px-3 text-right text-gray-300 font-mono text-sm">${r.avg_latency_ms}ms</td>
        <td class="py-2.5 px-3 text-right text-gray-400 font-mono text-sm">${r.avg_tokens}</td>
        <td class="py-2.5 px-3 text-right text-gray-400 font-mono text-sm">$${r.total_cost.toFixed(5)}</td>
        <td class="py-2.5 px-3 text-right text-gray-400 text-sm">${r.avg_citations}</td>
        <td class="py-2.5 px-3">
          <div class="flex items-center justify-center gap-2">
            <div class="w-16 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div class="h-full rounded-full ${r.consistency >= 80 ? 'bg-emerald-500' : r.consistency >= 50 ? 'bg-amber-500' : 'bg-red-500'}" style="width: ${r.consistency}%"></div>
            </div>
            <span class="text-xs text-gray-400">${r.consistency}%</span>
          </div>
        </td>
        <td class="py-2.5 px-3 text-right">
          <span class="text-xs px-2 py-0.5 rounded-full ${r.success_rate === 100 ? 'bg-emerald-900/50 text-emerald-400' : r.success_rate > 0 ? 'bg-amber-900/50 text-amber-400' : 'bg-red-900/50 text-red-400'}">${r.success_rate}%</span>
        </td>
      </tr>
    `).join("")
  }

  _renderDetails(results) {
    const sorted = this._sortedResults(results)

    this.detailCardsTarget.innerHTML = sorted.map(r => {
      const modelsHtml = Object.entries(r.model_summary || {}).map(([model, stats]) => `
        <div class="flex items-center justify-between text-xs py-1">
          <span class="text-gray-400 font-mono">${this._esc(model)}</span>
          <span class="text-gray-500">${stats.count} calls · ${stats.avg_latency_ms}ms avg · ${stats.success_rate}% success</span>
        </div>
      `).join("")

      const runsHtml = r.runs.map(run => `
        <tr class="border-b border-gray-800/30 text-xs">
          <td class="py-1 px-2 text-gray-500">#${run.run}</td>
          <td class="py-1 px-2 text-gray-400 font-mono">${this._esc(run.model)}</td>
          <td class="py-1 px-2 text-right text-gray-400">${run.latency_ms}ms</td>
          <td class="py-1 px-2 text-right text-gray-400">${run.total_tokens}</td>
          <td class="py-1 px-2 text-right">
            ${run.success
              ? '<span class="text-emerald-400">✓</span>'
              : `<span class="text-red-400" title="${this._esc(run.error || '')}">✗</span>`}
          </td>
        </tr>
      `).join("")

      return `
        <div class="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <button type="button" data-action="click->benchmarks#toggleDetail"
                  class="w-full p-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors text-left">
            <div>
              <h4 class="text-sm font-semibold text-gray-300">${this._esc(r.test_name)}</h4>
              <p class="text-xs text-gray-500 mt-0.5">
                ${r.runs.length} run${r.runs.length !== 1 ? "s" : ""} · ${r.success_rate}% success · ${Object.keys(r.model_summary || {}).join(", ")}
              </p>
            </div>
            <div class="text-right">
              <div class="text-sm text-gray-300 font-mono">${r.avg_latency_ms}ms</div>
              <div class="text-xs text-gray-500">$${r.total_cost.toFixed(5)}</div>
            </div>
          </button>
          <div class="detail-body hidden border-t border-gray-800 p-4 space-y-3">
            ${modelsHtml ? `<div><h5 class="text-xs font-medium text-gray-500 mb-1">Models</h5>${modelsHtml}</div>` : ""}
            <div>
              <h5 class="text-xs font-medium text-gray-500 mb-1">Consistency</h5>
              <div class="flex items-center gap-2">
                <div class="w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div class="h-full rounded-full ${r.consistency >= 80 ? 'bg-emerald-500' : r.consistency >= 50 ? 'bg-amber-500' : 'bg-red-500'}" style="width: ${r.consistency}%"></div>
                </div>
                <span class="text-xs text-gray-400">${r.consistency}%</span>
              </div>
            </div>
            <div>
              <h5 class="text-xs font-medium text-gray-500 mb-1">Individual Runs</h5>
              <table class="w-full">
                <thead><tr class="text-xs text-gray-600">
                  <th class="text-left py-1 px-2">Run</th>
                  <th class="text-left py-1 px-2">Model</th>
                  <th class="text-right py-1 px-2">Latency</th>
                  <th class="text-right py-1 px-2">Tokens</th>
                  <th class="text-right py-1 px-2">Status</th>
                </tr></thead>
                <tbody>${runsHtml}</tbody>
              </table>
            </div>
          </div>
        </div>
      `
    }).join("")
  }

  toggleDetail(event) {
    const card = event.currentTarget.closest(".bg-gray-900")
    const body = card.querySelector(".detail-body")
    if (body) body.classList.toggle("hidden")
  }

  _sortedResults(results) {
    const sortBy = this.hasSortSelectTarget ? this.sortSelectTarget.value : "latency"
    return [...results].sort((a, b) => {
      if (sortBy === "latency") return a.avg_latency_ms - b.avg_latency_ms
      if (sortBy === "cost") return a.total_cost - b.total_cost
      return b.consistency - a.consistency
    })
  }

  // ── Export ──

  exportJson() {
    this._exportBenchmarks("json")
  }

  exportCsv() {
    this._exportBenchmarks("csv")
  }

  async exportPdf() {
    await this._exportBenchmarks("pdf")
  }

  async _exportBenchmarks(format) {
    if (!this.benchmarkResults) return

    const filenameBase = `benchmarks-${new Date().toISOString().slice(0, 10)}`

    if (format === "json") {
      this._downloadString(
        JSON.stringify(this.benchmarkResults, null, 2),
        `${filenameBase}.json`,
        "application/json"
      )
      return
    }

    if (format === "csv") {
      this._downloadString(
        this._buildBenchmarkCsv(),
        `${filenameBase}.csv`,
        "text/csv"
      )
      return
    }

    if (format === "pdf") {
      const pdfBytes = await this._buildBenchmarkPdf()
      this._downloadBlob(
        new Blob([pdfBytes], { type: "application/pdf" }),
        `${filenameBase}.pdf`
      )
    }
  }

  _buildBenchmarkCsv() {
    const rows = [
      "Test Name,Model(s),Avg Latency (ms),Avg Tokens,Cost ($),Avg Citations,Consistency (%),Success Rate (%)"
    ]

    for (const result of this.benchmarkResults.results) {
      rows.push([
        `"${result.test_name}"`,
        `"${Object.keys(result.model_summary || {}).join("|")}"`,
        result.avg_latency_ms,
        result.avg_tokens,
        result.total_cost.toFixed(6),
        result.avg_citations,
        result.consistency,
        result.success_rate
      ].join(","))
    }

    return rows.join("\n")
  }

  async _buildBenchmarkPdf() {
    const pdf = await PDFDocument.create()
    const fonts = {
      regular: await pdf.embedFont(StandardFonts.Helvetica),
      bold: await pdf.embedFont(StandardFonts.HelveticaBold),
      mono: await pdf.embedFont(StandardFonts.Courier)
    }
    const palette = {
      ink: rgb(0.11, 0.14, 0.18),
      muted: rgb(0.42, 0.46, 0.52),
      border: rgb(0.84, 0.87, 0.9),
      accent: rgb(0.11, 0.45, 0.82),
      accentSoft: rgb(0.9, 0.95, 1),
      success: rgb(0.09, 0.55, 0.3),
      warn: rgb(0.79, 0.53, 0.11),
      danger: rgb(0.76, 0.2, 0.24)
    }
    const ctx = this._createPdfContext(pdf)
    const summary = this.benchmarkResults.summary || {}
    const results = this._sortedResults(this.benchmarkResults.results || [])
    const timestamp = this._pdfTimestamp()

    this._drawPdfText(ctx, "Benchmark Results", {
      x: ctx.margin,
      y: ctx.y,
      size: 20,
      font: fonts.bold,
      color: palette.ink
    })
    ctx.y -= 18

    this._drawPdfText(ctx, "AI performance benchmark export", {
      x: ctx.margin,
      y: ctx.y,
      size: 10,
      font: fonts.regular,
      color: palette.muted
    })

    this._drawPdfText(ctx, timestamp, {
      x: ctx.width - ctx.margin - fonts.regular.widthOfTextAtSize(timestamp, 10),
      y: ctx.y,
      size: 10,
      font: fonts.regular,
      color: palette.muted
    })
    ctx.y -= 28

    this._drawPdfSummary(ctx, fonts, palette, summary)
    ctx.y -= 12

    this._drawPdfSectionTitle(ctx, fonts, palette, "Results Table")
    this._drawPdfResultsTable(ctx, fonts, palette, results)
    ctx.y -= 8

    this._drawPdfSectionTitle(ctx, fonts, palette, "Per-Test Details")
    this._drawPdfDetails(ctx, fonts, palette, results)

    return pdf.save()
  }

  _createPdfContext(pdf) {
    const page = pdf.addPage([612, 792])
    return {
      pdf,
      page,
      width: page.getWidth(),
      height: page.getHeight(),
      margin: 40,
      y: page.getHeight() - 48
    }
  }

  _addPdfPage(ctx) {
    ctx.page = ctx.pdf.addPage([612, 792])
    ctx.width = ctx.page.getWidth()
    ctx.height = ctx.page.getHeight()
    ctx.y = ctx.height - 48
  }

  _ensurePdfSpace(ctx, minHeight) {
    if (ctx.y - minHeight >= ctx.margin) return false
    this._addPdfPage(ctx)
    return true
  }

  _drawPdfSummary(ctx, fonts, palette, summary) {
    const cards = [
      { label: "Avg Latency", value: `${summary.avg_latency_ms || 0}ms` },
      { label: "Total Cost", value: `$${(summary.total_cost || 0).toFixed(5)}` },
      { label: "Avg TTFT", value: summary.avg_time_to_first_token_ms != null ? `${summary.avg_time_to_first_token_ms}ms` : "N/A" },
      { label: "Avg Consistency", value: `${summary.avg_consistency || 0}%` },
      { label: "Success Rate", value: `${summary.overall_success_rate || 0}%` }
    ]
    const gap = 12
    const colWidth = (ctx.width - (ctx.margin * 2) - gap) / 2
    const cardHeight = 48
    const rows = []

    for (let index = 0; index < cards.length; index += 2) {
      rows.push(cards.slice(index, index + 2))
    }

    rows.forEach(row => {
      this._ensurePdfSpace(ctx, cardHeight + 10)
      const topY = ctx.y

      row.forEach((card, column) => {
        const x = ctx.margin + (column * (colWidth + gap))

        ctx.page.drawRectangle({
          x,
          y: topY - cardHeight + 6,
          width: colWidth,
          height: cardHeight,
          borderColor: palette.border,
          borderWidth: 1,
          color: palette.accentSoft
        })
        this._drawPdfText(ctx, card.label, {
          x: x + 12,
          y: topY - 10,
          size: 9,
          font: fonts.bold,
          color: palette.muted
        })
        this._drawPdfText(ctx, card.value, {
          x: x + 12,
          y: topY - 27,
          size: 14,
          font: fonts.bold,
          color: palette.ink
        })
      })

      ctx.y = topY - cardHeight - 10
    })
  }

  _drawPdfSectionTitle(ctx, fonts, palette, title) {
    this._ensurePdfSpace(ctx, 24)
    this._drawPdfText(ctx, title, {
      x: ctx.margin,
      y: ctx.y,
      size: 13,
      font: fonts.bold,
      color: palette.accent
    })
    ctx.y -= 16
    ctx.page.drawLine({
      start: { x: ctx.margin, y: ctx.y },
      end: { x: ctx.width - ctx.margin, y: ctx.y },
      thickness: 1,
      color: palette.border
    })
    ctx.y -= 12
  }

  _drawPdfResultsTable(ctx, fonts, palette, results) {
    const columns = [
      { key: "test", label: "Test", width: 182, align: "left" },
      { key: "latency", label: "Latency", width: 56, align: "right" },
      { key: "tokens", label: "Tokens", width: 52, align: "right" },
      { key: "cost", label: "Cost", width: 56, align: "right" },
      { key: "citations", label: "Citations", width: 56, align: "right" },
      { key: "consistency", label: "Consistency", width: 72, align: "right" },
      { key: "success", label: "Success", width: 58, align: "right" }
    ]

    const drawHeader = () => {
      this._ensurePdfSpace(ctx, 24)
      let cursorX = ctx.margin
      columns.forEach(column => {
        this._drawPdfCellText(ctx, column.label, {
          x: cursorX,
          y: ctx.y,
          width: column.width,
          align: column.align,
          size: 8,
          font: fonts.bold,
          color: palette.muted
        })
        cursorX += column.width
      })
      ctx.y -= 12
      ctx.page.drawLine({
        start: { x: ctx.margin, y: ctx.y },
        end: { x: ctx.width - ctx.margin, y: ctx.y },
        thickness: 1,
        color: palette.border
      })
      ctx.y -= 10
    }

    drawHeader()

    results.forEach(result => {
      const nameLines = this._wrapPdfText(result.test_name || "", 170, fonts.bold, 8)
      const descriptionLines = this._wrapPdfText(result.description || "", 170, fonts.regular, 7)
      const rowHeight = Math.max(18, (nameLines.length * 10) + (descriptionLines.length * 8) + 6)

      if (this._ensurePdfSpace(ctx, rowHeight + 10)) {
        drawHeader()
      }

      let cursorX = ctx.margin
      const topY = ctx.y

      let lineY = topY
      nameLines.forEach(line => {
        this._drawPdfText(ctx, line, {
          x: cursorX,
          y: lineY,
          size: 8,
          font: fonts.bold,
          color: palette.ink
        })
        lineY -= 10
      })
      descriptionLines.forEach(line => {
        this._drawPdfText(ctx, line, {
          x: cursorX,
          y: lineY,
          size: 7,
          font: fonts.regular,
          color: palette.muted
        })
        lineY -= 8
      })
      cursorX += columns[0].width

      const cells = [
        `${result.avg_latency_ms}ms`,
        `${result.avg_tokens}`,
        `$${result.total_cost.toFixed(5)}`,
        `${result.avg_citations}`,
        `${result.consistency}%`,
        `${result.success_rate}%`
      ]

      cells.forEach((value, index) => {
        const column = columns[index + 1]
        this._drawPdfCellText(ctx, value, {
          x: cursorX,
          y: topY,
          width: column.width,
          align: column.align,
          size: 8,
          font: index === 1 ? fonts.mono : fonts.regular,
          color: palette.ink
        })
        cursorX += column.width
      })

      ctx.page.drawLine({
        start: { x: ctx.margin, y: topY - rowHeight + 4 },
        end: { x: ctx.width - ctx.margin, y: topY - rowHeight + 4 },
        thickness: 0.75,
        color: palette.border
      })
      ctx.y = topY - rowHeight
    })
  }

  _drawPdfDetails(ctx, fonts, palette, results) {
    results.forEach(result => {
      this._ensurePdfSpace(ctx, 72)

      this._drawPdfText(ctx, result.test_name || "Untitled Test", {
        x: ctx.margin,
        y: ctx.y,
        size: 12,
        font: fonts.bold,
        color: palette.ink
      })
      ctx.y -= 14

      const descriptionLines = this._wrapPdfText(result.description || "", ctx.width - (ctx.margin * 2), fonts.regular, 9)
      descriptionLines.forEach(line => {
        this._drawPdfText(ctx, line, {
          x: ctx.margin,
          y: ctx.y,
          size: 9,
          font: fonts.regular,
          color: palette.muted
        })
        ctx.y -= 11
      })

      const statLine = `Avg latency ${result.avg_latency_ms}ms   Cost $${result.total_cost.toFixed(5)}   Consistency ${result.consistency}%   Success ${result.success_rate}%`
      this._drawPdfText(ctx, statLine, {
        x: ctx.margin,
        y: ctx.y,
        size: 8,
        font: fonts.mono,
        color: palette.ink
      })
      ctx.y -= 16

      if (Object.keys(result.model_summary || {}).length > 0) {
        this._drawPdfText(ctx, "Model Breakdown", {
          x: ctx.margin,
          y: ctx.y,
          size: 9,
          font: fonts.bold,
          color: palette.accent
        })
        ctx.y -= 12

        Object.entries(result.model_summary || {}).forEach(([model, stats]) => {
          this._ensurePdfSpace(ctx, 12)
          const modelLine = `${model}  |  ${stats.count} calls  |  ${stats.avg_latency_ms}ms avg  |  ${stats.success_rate}% success`
          this._drawPdfText(ctx, modelLine, {
            x: ctx.margin + 8,
            y: ctx.y,
            size: 8,
            font: fonts.mono,
            color: palette.ink
          })
          ctx.y -= 11
        })
      }

      ctx.y -= 2
      this._drawPdfText(ctx, "Individual Runs", {
        x: ctx.margin,
        y: ctx.y,
        size: 9,
        font: fonts.bold,
        color: palette.accent
      })
      ctx.y -= 12
      this._drawPdfRunHeader(ctx, fonts, palette)

      result.runs.forEach(run => {
        const extraLines = run.error
          ? this._wrapPdfText(`Error: ${run.error}`, 440, fonts.regular, 7)
          : []
        const rowHeight = 12 + (extraLines.length * 8)
        if (this._ensurePdfSpace(ctx, rowHeight + 8)) {
          this._drawPdfRunHeader(ctx, fonts, palette)
        }

        const topY = ctx.y
        const cells = [
          `#${run.run}`,
          run.model || "unknown",
          `${run.latency_ms}ms`,
          `${run.total_tokens}`,
          run.success ? "Success" : "Failed"
        ]
        const columns = [50, 200, 70, 70, 70]
        let cursorX = ctx.margin

        cells.forEach((value, index) => {
          this._drawPdfCellText(ctx, value, {
            x: cursorX,
            y: topY,
            width: columns[index],
            align: index >= 2 ? "right" : "left",
            size: 8,
            font: index === 1 ? fonts.mono : fonts.regular,
            color: index === 4
              ? (run.success ? palette.success : palette.danger)
              : palette.ink
          })
          cursorX += columns[index]
        })

        let errorY = topY - 10
        extraLines.forEach(line => {
          this._drawPdfText(ctx, line, {
            x: ctx.margin + 8,
            y: errorY,
            size: 7,
            font: fonts.regular,
            color: palette.danger
          })
          errorY -= 8
        })

        ctx.page.drawLine({
          start: { x: ctx.margin, y: topY - rowHeight + 2 },
          end: { x: ctx.width - ctx.margin, y: topY - rowHeight + 2 },
          thickness: 0.75,
          color: palette.border
        })
        ctx.y = topY - rowHeight
      })

      ctx.y -= 14
    })
  }

  _drawPdfRunHeader(ctx, fonts, palette) {
    const columns = [
      { label: "Run", width: 50, align: "left" },
      { label: "Model", width: 200, align: "left" },
      { label: "Latency", width: 70, align: "right" },
      { label: "Tokens", width: 70, align: "right" },
      { label: "Status", width: 70, align: "right" }
    ]

    let cursorX = ctx.margin
    columns.forEach(column => {
      this._drawPdfCellText(ctx, column.label, {
        x: cursorX,
        y: ctx.y,
        width: column.width,
        align: column.align,
        size: 8,
        font: fonts.bold,
        color: palette.muted
      })
      cursorX += column.width
    })
    ctx.y -= 11
    ctx.page.drawLine({
      start: { x: ctx.margin, y: ctx.y },
      end: { x: ctx.width - ctx.margin, y: ctx.y },
      thickness: 1,
      color: palette.border
    })
    ctx.y -= 10
  }

  _drawPdfCellText(ctx, text, { x, y, width, align = "left", size, font, color }) {
    const content = `${text ?? ""}`
    const textWidth = font.widthOfTextAtSize(content, size)
    const drawX = align === "right"
      ? x + width - textWidth
      : x

    this._drawPdfText(ctx, content, { x: drawX, y, size, font, color })
  }

  _drawPdfText(ctx, text, { x, y, size, font, color }) {
    ctx.page.drawText(`${text ?? ""}`, { x, y, size, font, color })
  }

  _wrapPdfText(text, maxWidth, font, size) {
    if (!text) return []

    const words = `${text}`.split(/\s+/)
    const lines = []
    let current = ""

    words.forEach(word => {
      const candidate = current ? `${current} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate
        return
      }

      if (current) lines.push(current)
      current = word
    })

    if (current) lines.push(current)
    return lines
  }

  _pdfTimestamp() {
    return `Generated ${new Date().toLocaleString()}`
  }

  _downloadString(content, filename, type) {
    this._downloadBlob(new Blob([content], { type }), filename)
  }

  _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // ═══ OPS METRICS ═══

  async refreshOps() {
    if (this.hasRefreshBtnTarget) {
      this.refreshBtnTarget.disabled = true
      this.refreshBtnTarget.textContent = "Loading..."
    }

    try {
      const [metricsResp, ciResp] = await Promise.all([
        fetch("/api/ops/metrics"),
        fetch("/api/ops/ci_status")
      ])

      const metrics = await metricsResp.json()
      const ciStatus = await ciResp.json()

      if (metricsResp.ok) this._renderOpsMetrics(metrics)
      this._renderCiStatus(ciStatus)
    } catch {
      // Metrics unavailable
      this._renderCiStatus({ status: "unavailable", message: "Unable to load CI status" })
    } finally {
      if (this.hasRefreshBtnTarget) {
        this.refreshBtnTarget.disabled = false
        this.refreshBtnTarget.textContent = "Refresh Metrics"
      }
    }
  }

  _renderCiStatus(ciStatus) {
    if (!ciStatus) return

    if (this.hasCiProviderTarget) this.ciProviderTarget.textContent = ciStatus.provider || "GitHub Actions"

    if (this.hasCiConclusionTarget) {
      const conclusion = ciStatus.conclusion || ciStatus.status || "unknown"
      this.ciConclusionTarget.textContent = conclusion
      this.ciConclusionTarget.className = this._ciConclusionClass(conclusion)
    }

    if (this.hasCiBranchTarget) this.ciBranchTarget.textContent = ciStatus.branch || "—"
    if (this.hasCiUpdatedAtTarget) this.ciUpdatedAtTarget.textContent = ciStatus.run_updated_at || "—"

    if (this.hasCiRunLinkTarget) {
      const hasLink = !!ciStatus.run_url
      this.ciRunLinkTarget.classList.toggle("hidden", !hasLink)
      this.ciRunLinkTarget.href = hasLink ? ciStatus.run_url : "#"
    }

    if (this.hasCiMessageTarget) this.ciMessageTarget.textContent = ciStatus.message || ""
  }

  _ciConclusionClass(conclusion) {
    const value = (conclusion || "").toLowerCase()
    if (value === "success") return "text-emerald-400 font-medium"
    if (value === "failure" || value === "failed" || value === "cancelled") return "text-red-400 font-medium"
    if (value === "in_progress" || value === "queued" || value === "waiting") return "text-amber-400 font-medium"
    return "text-gray-400"
  }

  _renderOpsMetrics(data) {
    const metrics = data.metrics || data

    if (this.hasTotalRequestsTarget) this.totalRequestsTarget.textContent = metrics.total_requests || 0
    if (this.hasAvgLatencyTarget) this.avgLatencyTarget.textContent = `${Math.round(metrics.avg_latency_ms || 0)}ms`

    const errRate = metrics.total_requests > 0
      ? ((metrics.total_errors || 0) / metrics.total_requests * 100).toFixed(1)
      : "0.0"
    if (this.hasErrorRateTarget) this.errorRateTarget.textContent = `${errRate}%`

    if (metrics.uptime_seconds && this.hasUptimeTarget) {
      const hours = Math.floor(metrics.uptime_seconds / 3600)
      const minutes = Math.floor((metrics.uptime_seconds % 3600) / 60)
      this.uptimeTarget.textContent = `${hours}h ${minutes}m`
    }

    if (metrics.routes && Object.keys(metrics.routes).length > 0 && this.hasRouteTableTarget) {
      this.routeTableTarget.innerHTML = Object.entries(metrics.routes).map(([route, stats]) => `
        <tr class="border-b border-gray-800/50">
          <td class="py-2 px-3 text-gray-300 font-mono text-xs">${this._esc(route)}</td>
          <td class="py-2 px-3 text-right text-gray-400">${stats.count || 0}</td>
          <td class="py-2 px-3 text-right text-gray-400">${Math.round(stats.avg_ms || 0)}</td>
          <td class="py-2 px-3 text-right text-gray-400">${Math.round(stats.p95_ms || 0)}</td>
          <td class="py-2 px-3 text-right ${(stats.errors || 0) > 0 ? 'text-red-400' : 'text-gray-500'}">${stats.errors || 0}</td>
        </tr>
      `).join("")
    }

    if (metrics.models && Object.keys(metrics.models).length > 0 && this.hasModelUsageTarget) {
      this.modelUsageTarget.innerHTML = Object.entries(metrics.models).map(([model, count]) => `
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-400 font-mono">${this._esc(model)}</span>
          <span class="text-sm text-gray-300 font-medium">${count}</span>
        </div>
      `).join("")
    }
  }

  _esc(text) {
    const div = document.createElement("div")
    div.textContent = text || ""
    return div.innerHTML
  }
}
