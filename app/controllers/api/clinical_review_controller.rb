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
      11. Every clinically meaningful conclusion must include inline citations using [N1], [N2], etc. for indexed note evidence and [P1], [P2], etc. for PubMed evidence.
      12. Add a short ## References section listing only the note and PubMed reference ids you actually cited.

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
      imported_context = params[:imported_context]&.permit(:source_text, :analysis, :model)&.to_h || {}
      imported_source_text = sanitize_input(imported_context[:source_text] || imported_context["source_text"])
      imported_analysis = sanitize_input(imported_context[:analysis] || imported_context["analysis"])
      imported_model = sanitize_input(imported_context[:model] || imported_context["model"])
      trace = []
      note_evidence = []
      evidence = []
      literature_query = nil

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

      trace << {
        title: "Conversation prep",
        detail: "Prepared #{clean_messages.length} message(s) for clinical review."
      }

      imported_sections = []
      if imported_source_text.present?
        imported_sections << "<workbench_source_text>\n#{imported_source_text.first(12_000)}\n</workbench_source_text>"
      end
      if imported_analysis.present?
        imported_sections << "<workbench_analysis>\n#{imported_analysis.first(8_000)}\n</workbench_analysis>"
      end
      if imported_sections.any?
        trace << {
          title: "Workbench handoff",
          detail: imported_model.present? ? "Included imported note context and prior workbench analysis from #{imported_model}." : "Included imported note context and prior workbench analysis."
        }
      end

      last_user_msg = clean_messages.reverse.find { |m| m[:role] == "user" }
      note_query_source = last_user_msg&.dig(:content) || imported_analysis.presence || imported_source_text.first(1000)
      note_query = sanitize_input(note_query_source)
      if note_query.present?
        begin
          query_embedding = EmbeddingService.new.embed(note_query)
          note_matches = DocumentChunk.match(query_embedding, match_count: 3)
          note_evidence = note_matches.map.with_index do |chunk, index|
            {
              id: "N#{index + 1}",
              content: chunk[:content],
              similarity: chunk[:similarity],
              chunk_index: chunk[:chunk_index],
              source_label: "Indexed note evidence",
              doc_id: chunk[:doc_id]
            }
          end
        rescue EmbeddingService::EmbeddingError => e
          Rails.logger.warn("[ClinicalReviewController] Note evidence retrieval failed: #{e.message}")
        end
      end
      trace << {
        title: "Note evidence retrieval",
        detail: note_evidence.any? ? "Retrieved #{note_evidence.length} indexed note evidence passage(s) for the current review question." : "No indexed note evidence passages were retrieved, so the review falls back to the imported note context."
      }

      if last_user_msg || imported_source_text.present?
        begin
          pubmed = PubmedService.new
          pubmed_prompt = sanitize_input(last_user_msg&.dig(:content) || imported_analysis.presence || imported_source_text.first(300))
          result = pubmed.search(prompt: pubmed_prompt[0..200], context: pubmed_prompt)
          literature_query = result[:query]
          evidence = Array(result[:evidence]).map.with_index do |item, index|
            {
              id: "P#{index + 1}",
              title: item.title,
              snippet: item.abstract_snippet,
              source_label: item.source_label,
              source_url: item.source_url,
              pmc_url: item.pmc_url,
              journal: item.journal,
              published_at: item.published_at
            }
          end
        rescue PubmedService::PubmedError
          # Non-critical, continue without evidence
        end
      end

      trace << {
        title: "External evidence",
        detail: evidence.any? ? "Retrieved #{evidence.length} PubMed evidence snippet(s) for supporting review." : "No PubMed evidence snippets were retrieved for this review question."
      }

      system = SYSTEM_PROMPT.dup
      if imported_sections.any?
        system += "\n\n<imported_workbench_context>\n#{imported_sections.join("\n\n")}\n</imported_workbench_context>"
      end

      if note_evidence.any?
        note_context = note_evidence.map do |item|
          "[#{item[:id]}] chunk #{item[:chunk_index]} | score #{format("%.3f", item[:similarity])} | source #{item[:source_label]}\n#{item[:content]}"
        end.join("\n\n")
        system += "\n\n<note_evidence_context>\n#{note_context}\n</note_evidence_context>"
      elsif imported_source_text.present?
        system += "\n\n<note_evidence_context>\n[N0] Imported source note fallback\n#{imported_source_text.first(12_000)}\n</note_evidence_context>"
      end

      if evidence.any?
        external_context = evidence.map do |e|
          "[#{e[:id]}] #{e[:source_label]} | #{e[:journal] || "Unknown journal"} | #{e[:published_at] || "Unknown date"}\nTitle: #{e[:title]}\nAbstract: #{e[:snippet]}"
        end.join("\n\n")
        system += "\n\n<external_literature_context>\n#{external_context}\n</external_literature_context>"
      end

      service = GoogleTextService.new
      result = service.generate(system: system, messages: clean_messages)

      trace << {
        title: "Model synthesis",
        detail: "Generated clinical review response using #{result.model}."
      }

      if result.thinking.present?
        trace << {
          title: "AI reasoning captured",
          detail: "The model's internal reasoning chain is shown in the thinking panel above."
        }
      end

      response.headers["X-Model-Used"] = result.model
      audit(route: "/api/clinical-review", status: 200, started_at: started_at, model_used: result.model)
      render_ok({ response: result.text, model: result.model, thinking: result.thinking.presence, evidence: evidence, note_evidence: note_evidence, literature_query: literature_query, trace: trace })

    rescue GoogleTextService::GenerationError => e
      audit(route: "/api/clinical-review", status: 500, started_at: started_at, error: e.message)
      render_error(e.message, :internal_server_error)
    end
  end
end
