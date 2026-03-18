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
  MAX_TOTAL_SECONDS = 90
  MAX_TIMEOUT_RETRIES = 1
  API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

  Result = Data.define(:text, :model, :thinking)

  class GenerationError < StandardError; end

  def initialize(api_key: nil)
    @api_key = api_key ||
      Rails.application.credentials.dig(:google, :api_key) ||
      ENV["GOOGLE_GENERATIVE_AI_API_KEY"] ||
      ENV["GOOGLE_API_KEY"]
    raise GenerationError, "Missing Google AI API key" unless @api_key.present?
  end

  def generate(system:, messages:)
    last_error = "Google text generation failed"
    timeout_count = 0
    started_at = Process.clock_gettime(Process::CLOCK_MONOTONIC)

    FALLBACK_MODELS.each do |model|
      break if elapsed_generation_seconds(started_at) >= MAX_TOTAL_SECONDS

      request_modes = supports_system_instruction?(model) ? [true, false] : [false]

      request_modes.each do |use_system_instruction|
        break if elapsed_generation_seconds(started_at) >= MAX_TOTAL_SECONDS

        response = call_model(model, system, messages, use_system_instruction)

        case response
        in { error: String => msg, status: 400, developer_instruction_issue: true } if use_system_instruction
          next
        in { error: String => msg, status: 408 }
          timeout_count += 1
          last_error = msg
          if timeout_count >= MAX_TIMEOUT_RETRIES
            raise GenerationError, "Model request timed out. Please retry with a shorter prompt or try again in a moment."
          end
          break
        in { error: String => msg, status: 429 | 503 }
          last_error = msg
          break
        in { error: String => msg }
          raise GenerationError, msg
        in { text: String => text, model: String => used_model, thinking: String => thinking } if text.present?
          return Result.new(text: text, model: used_model, thinking: thinking)
        in { text: String }
          last_error = "Model #{model} returned no visible content."
        end
      end
    end

    if elapsed_generation_seconds(started_at) >= MAX_TOTAL_SECONDS
      raise GenerationError, "Clinical review generation exceeded the time limit. Please retry."
    end

    raise GenerationError, last_error
  end

  def elapsed_generation_seconds(started_at)
    Process.clock_gettime(Process::CLOCK_MONOTONIC) - started_at
  end

  private

  def supports_system_instruction?(model)
    !model.start_with?("gemma-")
  end

  def supports_thinking?(model)
    model.start_with?("gemini-2.5")
  end

  def call_model(model, system, messages, use_system_instruction)
    url = "#{API_BASE}/#{model}:generateContent?key=#{CGI.escape(@api_key)}"
    body = build_request_body(system, messages, use_system_instruction, model: model)

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

    extracted = extract_response(data)
    { text: extracted[:text], model: model, thinking: extracted[:thinking] }
  rescue Net::OpenTimeout, Net::ReadTimeout
    { error: "Model #{model} timed out", status: 408 }
  end

  def build_request_body(system, messages, use_system_instruction, model: nil)
    contents = messages.map do |msg|
      {
        role: msg[:role] == "assistant" ? "model" : "user",
        parts: [{ text: msg[:content] }]
      }
    end

    body = if use_system_instruction
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

    if model && supports_thinking?(model)
      body[:generationConfig] = { thinkingConfig: { thinkingBudget: 4096 } }
    end

    body
  end

  def extract_response(data)
    candidates = data["candidates"] || []
    parts = candidates.flat_map { |c| c.dig("content", "parts") || [] }

    thinking = parts.select { |p| p["thought"] == true }.map { |p| p["text"].to_s }.join("\n").strip
    text = parts.reject { |p| p["thought"] == true }.map { |p| p["text"].to_s }.join("").strip

    { text: text, thinking: thinking }
  end
end
