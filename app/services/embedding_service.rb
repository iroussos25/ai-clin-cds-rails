class EmbeddingService
  ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent"
  DIMENSION = 768
  TIMEOUT_SECONDS = 30

  class EmbeddingError < StandardError; end

  def initialize(api_key: nil)
    @api_key = api_key || Rails.application.credentials.dig(:google, :api_key) || ENV["GOOGLE_GENERATIVE_AI_API_KEY"]
    raise EmbeddingError, "Missing Google AI API key" unless @api_key.present?
  end

  def embed(text)
    uri = URI.parse("#{ENDPOINT}?key=#{CGI.escape(@api_key)}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.open_timeout = 10
    http.read_timeout = TIMEOUT_SECONDS

    request = Net::HTTP::Post.new(uri.request_uri)
    request["Content-Type"] = "application/json"
    request.body = {
      model: "models/gemini-embedding-001",
      outputDimensionality: DIMENSION,
      content: { parts: [{ text: text }] }
    }.to_json

    response = http.request(request)

    unless response.is_a?(Net::HTTPSuccess)
      raise EmbeddingError, "Embedding request failed (#{response.code})"
    end

    data = JSON.parse(response.body)
    values = data.dig("embedding", "values")

    raise EmbeddingError, "Embedding response did not include vector values" if values.blank?
    raise EmbeddingError, "Embedding dimension mismatch: expected #{DIMENSION}, got #{values.length}" if values.length != DIMENSION

    values
  rescue Net::OpenTimeout, Net::ReadTimeout
    raise EmbeddingError, "Embedding request timed out"
  end
end
