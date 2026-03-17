require "cgi"
require "json"
require "net/http"
require "uri"

class GoogleTextService
  FALLBACK_MODELS = %w[
    gemini-2.5-flash
    gemini-flash-lite-latest
    gemma-3-4b-it
    gemma-3-12b-it
    gemma-3-1b-it
  ].freeze

  TIMEOUT_SECONDS = 45
  API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

  Result = Data.define(:text, :model)

  class GenerationError < StandardError; end

  def initialize(api_key: nil)
    @api_key = api_key || Rails.application.credentials.dig(:google, :api_key) || ENV["GOOGLE_GENERATIVE_AI_API_KEY"]
    raise GenerationError, "Missing Google AI API key" unless @api_key.present?
  end

  def generate(system:, messages:)
    last_error = "Google text generation failed"

    FALLBACK_MODELS.each do |model|
      request_modes = supports_system_instruction?(model) ? [true, false] : [false]

      request_modes.each do |use_system_instruction|
        response = call_model(model, system, messages, use_system_instruction)

        case response
        in { error: String => msg, status: 400, developer_instruction_issue: true } if use_system_instruction
          next
        in { error: String => msg, status: 408 | 429 | 503 }
          last_error = msg
          break
        in { error: String => msg }
          raise GenerationError, msg
        in { text: String => text, model: String => used_model } if text.present?
          return Result.new(text: text, model: used_model)
        in { text: String }
          last_error = "Model #{model} returned no visible content."
        end
      end
    end

    raise GenerationError, last_error
  end

  private

  def supports_system_instruction?(model)
    !model.start_with?("gemma-")
  end

  def call_model(model, system, messages, use_system_instruction)
    url = "#{API_BASE}/#{model}:generateContent?key=#{CGI.escape(@api_key)}"
    body = build_request_body(system, messages, use_system_instruction)

    uri = URI.parse(url)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.open_timeout = 10
    http.read_timeout = TIMEOUT_SECONDS

    request = Net::HTTP::Post.new(uri.request_uri)
    request["Content-Type"] = "application/json"
    request.body = body.to_json

    response = http.request(request)
    data = JSON.parse(response.body) rescue {}

    unless response.is_a?(Net::HTTPSuccess)
      error_msg = data.dig("error", "message") || "Google generation failed (#{response.code})"
      developer_issue = response.code.to_i == 400 && error_msg.match?(/developer instruction is not enabled/i) && use_system_instruction

      return { error: error_msg, status: response.code.to_i, developer_instruction_issue: developer_issue }
    end

    text = extract_text(data)
    { text: text, model: model }
  rescue Net::OpenTimeout, Net::ReadTimeout
    { error: "Model #{model} timed out", status: 408 }
  end

  def build_request_body(system, messages, use_system_instruction)
    contents = messages.map do |msg|
      {
        role: msg[:role] == "assistant" ? "model" : "user",
        parts: [{ text: msg[:content] }]
      }
    end

    if use_system_instruction
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: contents
      }
    else
      inline_system = {
        role: "user",
        parts: [{ text: "System instructions:\n#{system}\n\nAcknowledge and follow these instructions for the rest of this conversation." }]
      }
      { contents: [inline_system, *contents] }
    end
  end

  def extract_text(data)
    candidates = data["candidates"] || []
    candidates
      .flat_map { |c| c.dig("content", "parts") || [] }
      .map { |p| p["text"].to_s }
      .join("")
      .strip
  end
end
