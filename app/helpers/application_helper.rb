module ApplicationHelper
  PANEL_CONFIG = {
    "workbench" => { label: "Analysis Workbench", icon: "🔬" },
    "clinical-review" => { label: "Clinical Review", icon: "📋" },
    "recruiter-kit" => { label: "Recruiter Kit", icon: "📦" },
    "fhir" => { label: "FHIR Explorer", icon: "⚕️" },
    "benchmarks" => { label: "Benchmarks", icon: "📊" }
  }.freeze

  def panel_label(panel)
    PANEL_CONFIG.dig(panel, :label) || panel.titleize
  end

  def panel_icon(panel)
    tag.span PANEL_CONFIG.dig(panel, :icon) || "📄", class: "mr-2"
  end
end
