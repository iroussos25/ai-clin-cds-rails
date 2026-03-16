import { Controller } from "@hotwired/stimulus"

// Benchmarks / metrics dashboard controller
export default class extends Controller {
  static targets = [
    "refreshBtn", "totalRequests", "avgLatency", "errorRate", "uptime",
    "routeTable", "modelUsage"
  ]

  connect() {
    this.refresh()
  }

  async refresh() {
    this.refreshBtnTarget.disabled = true
    this.refreshBtnTarget.textContent = "Loading..."

    try {
      const response = await fetch("/api/ops/metrics")
      const data = await response.json()

      if (response.ok) {
        this.renderMetrics(data)
      }
    } catch {
      // Metrics unavailable - leave defaults
    } finally {
      this.refreshBtnTarget.disabled = false
      this.refreshBtnTarget.textContent = "Refresh Metrics"
    }
  }

  renderMetrics(data) {
    const metrics = data.metrics || data

    // Summary cards
    this.totalRequestsTarget.textContent = metrics.total_requests || 0
    this.avgLatencyTarget.textContent = `${Math.round(metrics.avg_latency_ms || 0)}ms`

    const errorRate = metrics.total_requests > 0
      ? ((metrics.total_errors || 0) / metrics.total_requests * 100).toFixed(1)
      : "0.0"
    this.errorRateTarget.textContent = `${errorRate}%`

    if (metrics.uptime_seconds) {
      const hours = Math.floor(metrics.uptime_seconds / 3600)
      const minutes = Math.floor((metrics.uptime_seconds % 3600) / 60)
      this.uptimeTarget.textContent = `${hours}h ${minutes}m`
    }

    // Route table
    if (metrics.routes && Object.keys(metrics.routes).length > 0) {
      this.routeTableTarget.innerHTML = Object.entries(metrics.routes).map(([route, stats]) => `
        <tr class="border-b border-gray-800/50">
          <td class="py-2 px-3 text-gray-300 font-mono text-xs">${this.escapeHtml(route)}</td>
          <td class="py-2 px-3 text-right text-gray-400">${stats.count || 0}</td>
          <td class="py-2 px-3 text-right text-gray-400">${Math.round(stats.avg_ms || 0)}</td>
          <td class="py-2 px-3 text-right text-gray-400">${Math.round(stats.p95_ms || 0)}</td>
          <td class="py-2 px-3 text-right ${(stats.errors || 0) > 0 ? 'text-red-400' : 'text-gray-500'}">${stats.errors || 0}</td>
        </tr>
      `).join("")
    }

    // Model usage
    if (metrics.models && Object.keys(metrics.models).length > 0) {
      this.modelUsageTarget.innerHTML = Object.entries(metrics.models).map(([model, count]) => `
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-400 font-mono">${this.escapeHtml(model)}</span>
          <span class="text-sm text-gray-300 font-medium">${count}</span>
        </div>
      `).join("")
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div")
    div.textContent = text || ""
    return div.innerHTML
  }
}
