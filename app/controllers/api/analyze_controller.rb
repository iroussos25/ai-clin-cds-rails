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
      7. Every clinically meaningful conclusion must end with an inline citation using [N0] for the supplied note and [R1], [R2], etc. for retrieved indexed passages when relevant.
      8. Add a short ## References section at the end listing only the reference ids you actually cited.
    PROMPT

    def create
      started_at = Time.current

      text = sanitize_input(params[:text])
      use_rag = ActiveModel::Type::Boolean.new.cast(params[:use_rag])
      trace = []
      rag_matches = []

      if text.length < 10 || text.length > 180_000
        audit(route: "/api/analyze", status: 400, started_at: started_at, error: "Invalid text length")
        return render_error("Text must be between 10 and 180000 characters", :bad_request)
      end

      trace << {
        title: "Input processing",
        detail: "Validated #{text.length} characters of clinical text before analysis."
      }

      # Optionally augment with RAG context
      rag_context = ""
      if use_rag
        begin
          query_embedding = EmbeddingService.new.embed(text)
          rag_matches = DocumentChunk.match(query_embedding, match_count: 3)
          rag_context = rag_matches.map.with_index do |chunk, index|
            "[R#{index + 1}] doc #{chunk[:doc_id]} | chunk #{chunk[:chunk_index]} | score #{format("%.3f", chunk[:similarity])}\n#{chunk[:content]}"
          end.join("\n\n") if rag_matches.any?
          trace << {
            title: "RAG retrieval",
            detail: rag_matches.any? ? "Retrieved #{rag_matches.length} indexed context passage(s) to ground the analysis." : "RAG was enabled, but no indexed context passages matched this note."
          }
        rescue EmbeddingService::EmbeddingError => e
          Rails.logger.warn("[AnalyzeController] RAG embedding failed: #{e.message}")
          trace << {
            title: "RAG retrieval",
            detail: "RAG was enabled, but indexed context could not be retrieved. Analysis continued using only the supplied note."
          }
        end
      else
        trace << {
          title: "RAG retrieval",
          detail: "RAG was disabled. Analysis used only the supplied clinical note."
        }
      end

      prompt_content = "<clinical_document_context>\n[N0] Supplied clinical note\n#{text}\n</clinical_document_context>"
      prompt_content += "\n\n<rag_context>\n#{rag_context}\n</rag_context>" if rag_context.present?
      prompt_content += "\n\nAnalyze this clinical document thoroughly."

      service = GoogleTextService.new
      result = service.generate(
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt_content }]
      )

      trace << {
        title: "Model synthesis",
        detail: "Generated analysis using #{result.model}."
      }

      response.headers["X-Model-Used"] = result.model
      audit(route: "/api/analyze", status: 200, started_at: started_at, model_used: result.model)
      render_ok({
        analysis: result.text,
        model: result.model,
        trace: trace,
        evidence: rag_matches.map.with_index do |chunk, index|
          {
            id: "R#{index + 1}",
            content: chunk[:content],
            similarity: chunk[:similarity],
            chunk_index: chunk[:chunk_index],
            source_label: "Indexed note evidence",
            doc_id: chunk[:doc_id]
          }
        end,
        rag_contexts: rag_matches.map do |chunk|
          {
            content: chunk[:content],
            similarity: chunk[:similarity],
            doc_id: chunk[:doc_id]
          }
        end
      })

    rescue GoogleTextService::GenerationError => e
      audit(route: "/api/analyze", status: 500, started_at: started_at, error: e.message)
      render_error(e.message, :internal_server_error)
    end
  end
end
