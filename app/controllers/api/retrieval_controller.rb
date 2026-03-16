module Api
  class RetrievalController < BaseController
    def index_document
      started_at = Time.current

      context = sanitize_input(params[:context])
      file_name = params[:file_name]

      if context.length < 10 || context.length > 180_000
        audit(route: "/api/retrieval/index", status: 400, started_at: started_at, error: "Invalid context")
        return render_error("Context must be between 10 and 180000 characters", :bad_request)
      end

      doc_id = SecureRandom.uuid

      IndexDocumentJob.perform_later(doc_id: doc_id, context: context, file_name: file_name)

      audit(route: "/api/retrieval/index", status: 202, started_at: started_at)
      render_ok({ doc_id: doc_id, status: "indexing" }, status: :accepted)
    end

    def query
      started_at = Time.current

      query_text = sanitize_input(params[:query])
      doc_id = params[:doc_id]
      top_k = (params[:top_k] || 5).to_i.clamp(1, 12)

      if query_text.length < 1 || query_text.length > 3000
        audit(route: "/api/retrieval/query", status: 400, started_at: started_at, error: "Invalid query")
        return render_error("Query must be between 1 and 3000 characters", :bad_request)
      end

      embedder = EmbeddingService.new
      query_embedding = embedder.embed(query_text)
      results = DocumentChunk.match(query_embedding, match_count: top_k, doc_id: doc_id)

      audit(route: "/api/retrieval/query", status: 200, started_at: started_at)
      render_ok({ results: results })

    rescue EmbeddingService::EmbeddingError => e
      audit(route: "/api/retrieval/query", status: 500, started_at: started_at, error: e.message)
      render_error(e.message, :internal_server_error)
    end
  end
end
