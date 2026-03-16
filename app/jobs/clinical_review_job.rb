class ClinicalReviewJob < ApplicationJob
  queue_as :default

  SYSTEM_PROMPT = Api::ClinicalReviewController::SYSTEM_PROMPT

  def perform(session_id:, note_context:, messages:, external_evidence: [])
    external_context = build_external_context(external_evidence)

    system = "#{SYSTEM_PROMPT}\n\n<clinical_note_context>\n#{note_context}\n</clinical_note_context>"
    system += "\n\n<external_literature_context>\n#{external_context}\n</external_literature_context>" if external_context.present?

    service = GoogleTextService.new
    result = service.generate(system: system, messages: messages)

    ActionCable.server.broadcast("analysis_#{session_id}", {
      type: "review_complete",
      text: result.text,
      model: result.model
    })
  rescue GoogleTextService::GenerationError => e
    ActionCable.server.broadcast("analysis_#{session_id}", {
      type: "review_error",
      error: e.message
    })
  end

  private

  def build_external_context(evidence_items)
    evidence_items.filter_map.with_index do |item, index|
      title = item["title"].to_s.strip.presence || "Untitled source"
      snippet = item["abstract_snippet"].to_s.strip
      next if snippet.blank?

      journal = item["journal"].to_s.strip.presence || "Unknown journal"
      published_at = item["published_at"].to_s.strip.presence || "Unknown date"
      source_label = item["source_label"].to_s.strip.presence || "External literature"

      "[literature #{index + 1} | #{source_label} | #{journal} | #{published_at}]\nTitle: #{title}\nAbstract: #{snippet}"
    end.join("\n\n")
  end
end
