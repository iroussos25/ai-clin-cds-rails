module Api
  class PubmedController < BaseController
    def search
      started_at = Time.current

      query = sanitize_input(params[:query])

      if query.length < 2
        audit(route: "/api/pubmed/search", status: 400, started_at: started_at, error: "Invalid input")
        return render_error("Query is required (minimum 2 characters)", :bad_request)
      end

      service = PubmedService.new
      result = service.search(prompt: query, context: query)

      audit(route: "/api/pubmed/search", status: 200, started_at: started_at)
      render_ok(result)

    rescue PubmedService::PubmedError => e
      audit(route: "/api/pubmed/search", status: 500, started_at: started_at, error: e.message)
      render_error(e.message, :internal_server_error)
    end
  end
end
