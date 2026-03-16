module Api
  class ClinicalReviewController < BaseController
    SYSTEM_PROMPT = <<~PROMPT.freeze
      You are a clinical review assistant for research-oriented clinical decision support exploration.

      Rules you must follow:
      1. ONLY use the provided clinical note context and the provided external literature snippets. Do not use outside medical knowledge, web knowledge, or unstated assumptions beyond those sources.
      2. You may synthesize trends and describe patterns as potential clinical concerns, possible diagnoses to consider, or possible next clinical considerations, but never present them as confirmed diagnoses or final treatment orders.
      3. You must make uncertainty explicit. If the note does not contain enough evidence, say so clearly.
      4. You must not provide definitive medical advice, medication orders, or instructions that imply autonomous clinical decision-making.
      5. Keep the tone professional and analytically useful for a clinician reviewer.
      6. Use concise markdown headings when helpful.
      7. Ground every important claim in facts stated in the note or in the external literature context.
      8. Be explicit that external literature is general evidence and may not be patient-specific.
      9. Remind the reader when data appears incomplete, ambiguous, or conflicting.
      10. Do not use LaTeX or math delimiters in output.

      Preferred structure when the prompt is broad:
      ## Observed Trends
      ## Potential Clinical Concerns
      ## Possible Next Clinical Considerations
      ## Missing Data / Uncertainty
      ## Supporting Evidence From Note
      ## Supporting External Literature

      Final line requirement:
      Add this exact sentence at the end of every response: "For clinical decision support research only. Not for diagnostic use. Verify with a licensed healthcare professional."
    PROMPT

    def create
      started_at = Time.current

      messages = Array(params[:messages])
      include_evidence = ActiveModel::Type::Boolean.new.cast(params[:include_evidence])

      clean_messages = messages.filter_map do |msg|
        role = msg[:role].to_s
        content = sanitize_input(msg[:content])
        next unless %w[user assistant].include?(role) && content.present?
        { role: role, content: content }
      end

      if clean_messages.empty?
        audit(route: "/api/clinical-review", status: 400, started_at: started_at, error: "No valid messages")
        return render_error("No valid messages provided", :bad_request)
      end

      # Optionally fetch PubMed evidence
      evidence = []
      if include_evidence
        last_user_msg = clean_messages.reverse.find { |m| m[:role] == "user" }
        if last_user_msg
          begin
            pubmed = PubmedService.new
            result = pubmed.search(prompt: last_user_msg[:content][0..200], context: last_user_msg[:content])
            evidence = result[:articles] || []
          rescue PubmedService::PubmedError
            # Non-critical, continue without evidence
          end
        end
      end

      system = SYSTEM_PROMPT.dup
      if evidence.any?
        external_context = evidence.map.with_index { |e, i| "[#{i + 1}] #{e[:title]} - #{e[:abstract_snippet]}" }.join("\n")
        system += "\n\n<external_literature_context>\n#{external_context}\n</external_literature_context>"
      end

      service = GoogleTextService.new
      result = service.generate(system: system, messages: clean_messages)

      response.headers["X-Model-Used"] = result.model
      audit(route: "/api/clinical-review", status: 200, started_at: started_at, model_used: result.model)
      render_ok({ response: result.text, model: result.model, evidence: evidence })

    rescue GoogleTextService::GenerationError => e
      audit(route: "/api/clinical-review", status: 500, started_at: started_at, error: e.message)
      render_error(e.message, :internal_server_error)
    end
  end
end
