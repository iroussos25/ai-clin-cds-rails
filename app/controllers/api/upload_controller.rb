module Api
  class UploadController < BaseController
    def create
      started_at = Time.current
      file = params[:file]

      unless file.present?
        audit(route: "/api/upload", status: 400, started_at: started_at, error: "No file provided")
        return render_error("No file provided", :bad_request)
      end

      parser = FileParserService.new
      text = parser.parse(file)

      audit(route: "/api/upload", status: 200, started_at: started_at)
      render_ok({ content: text })

    rescue FileParserService::ParseError => e
      audit(route: "/api/upload", status: 400, started_at: started_at, error: e.message)
      render_error(e.message, :bad_request)
    end
  end
end
