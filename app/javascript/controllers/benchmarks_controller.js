import { Controller } from "@hotwired/stimulus"

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
    "routeTable", "modelUsage"
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
    if (!this.benchmarkResults) return
    this._download(
      JSON.stringify(this.benchmarkResults, null, 2),
      `benchmarks-${new Date().toISOString().slice(0, 10)}.json`,
      "application/json"
    )
  }

  exportCsv() {
    if (!this.benchmarkResults) return
    const rows = [
      "Test Name,Model(s),Avg Latency (ms),Avg Tokens,Cost ($),Avg Citations,Consistency (%),Success Rate (%)"
    ]
    for (const r of this.benchmarkResults.results) {
      rows.push([
        `"${r.test_name}"`,
        `"${Object.keys(r.model_summary || {}).join("|")}"`,
        r.avg_latency_ms,
        r.avg_tokens,
        r.total_cost.toFixed(6),
        r.avg_citations,
        r.consistency,
        r.success_rate
      ].join(","))
    }
    this._download(
      rows.join("\n"),
      `benchmarks-${new Date().toISOString().slice(0, 10)}.csv`,
      "text/csv"
    )
  }

  _download(content, filename, type) {
    const blob = new Blob([content], { type })
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
      const response = await fetch("/api/ops/metrics")
      const data = await response.json()
      if (response.ok) this._renderOpsMetrics(data)
    } catch {
      // Metrics unavailable
    } finally {
      if (this.hasRefreshBtnTarget) {
        this.refreshBtnTarget.disabled = false
        this.refreshBtnTarget.textContent = "Refresh Metrics"
      }
    }
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
