module Api
  class AnalyzeController < BaseController
    SYSTEM_PROMPT = <<~PROMPT.freeze
      You are a Clinical Data Integrity Specialist. Your sole responsibility is to analyze and answer questions based strictly on the clinical document context provided below.

      Rules you must follow:
      1. ONLY use information explicitly stated in the provided context. Do not use any prior medical knowledge or training data to supplement your answers.
      2. If the answer cannot be found in the context, respond with: "The provided clinical document does not contain sufficient information to answer this question."
      3. When referencing data from the context, be precise — cite specific values, dates, findings, or terminology exactly as they appear.
      4. Do not speculate, infer beyond what is written, or provide differential diagnoses unless they are explicitly mentioned in the context.
      5. Maintain a professional, concise tone appropriate for clinical data review.
      6. If the context contains ambiguous or potentially conflicting information, flag it explicitly rather than choosing one interpretation silently.
    PROMPT

    def create
      started_at = Time.current

      text = sanitize_input(params[:text])
      use_rag = ActiveModel::Type::Boolean.new.cast(params[:use_rag])

      if text.length < 10 || text.length > 180_000
        audit(route: "/api/analyze", status: 400, started_at: started_at, error: "Invalid text length")
        return render_error("Text must be between 10 and 180000 characters", :bad_request)
      end

      # Optionally augment with RAG context
      rag_context = ""
      if use_rag
        chunks = DocumentChunk.match(text, limit: 3)
        rag_context = chunks.map(&:content).join("\n\n") if chunks.any?
      end

      prompt_content = "<clinical_document_context>\n#{text}\n</clinical_document_context>"
      prompt_content += "\n\n<rag_context>\n#{rag_context}\n</rag_context>" if rag_context.present?
      prompt_content += "\n\nAnalyze this clinical document thoroughly."

      service = GoogleTextService.new
      result = service.generate(
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt_content }]
      )

      response.headers["X-Model-Used"] = result.model
      audit(route: "/api/analyze", status: 200, started_at: started_at, model_used: result.model)
      render_ok({ analysis: result.text, model: result.model })

    rescue GoogleTextService::GenerationError => e
      audit(route: "/api/analyze", status: 500, started_at: started_at, error: e.message)
      render_error(e.message, :internal_server_error)
    end
  end
end
