class AnalyzeJob < ApplicationJob
  queue_as :default

  SYSTEM_PROMPT = Api::AnalyzeController::SYSTEM_PROMPT

  def perform(session_id:, prompt:, context:)
    service = GoogleTextService.new
    result = service.generate(
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: "<clinical_document_context>\n#{context}\n</clinical_document_context>\n\nQuestion: #{prompt}"
        }
      ]
    )

    ActionCable.server.broadcast("analysis_#{session_id}", {
      type: "analysis_complete",
      text: result.text,
      model: result.model
    })
  rescue GoogleTextService::GenerationError => e
    ActionCable.server.broadcast("analysis_#{session_id}", {
      type: "analysis_error",
      error: e.message
    })
  end
end
