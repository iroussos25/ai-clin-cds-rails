class WorkbenchController < ApplicationController
  def index
    @panels = %w[workbench clinical-review recruiter-kit fhir benchmarks]
    @active_panel = params[:panel] || "workbench"
    @recruiter_kits = ClinicalConstants::RECRUITER_KITS.map do |kit|
      resolved = kit.dup
      resolved[:clinical_text] = ClinicalConstants.kit_context(kit)
      resolved
    end
  end
end
